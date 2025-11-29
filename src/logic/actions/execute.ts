import { playAudio } from '../../audio'
import type {
  ActionType,
  DiceRedistributionState,
  DiceSlotState,
  DiceType,
  MovementState,
  NextActions,
  PlayerId,
  ProcedureStep,
} from '../../types'
import { getActionTypeForStep } from './actionInfo'

interface StartRollOptions {
  player: PlayerId
  action: ActionType
  dice: DiceType[]
  launchRoll: (dice: DiceType[]) => { budget: MovementState['budget'] }
  onMovementStart: (state: MovementState) => void
}

export const startDiceRoll = ({ player, action, dice, launchRoll, onMovementStart }: StartRollOptions) => {
  if (!dice.length) return
  playAudio(dice.length === 1 ? 'diceSingle' : 'diceMulti')
  const { budget } = launchRoll(dice)
  onMovementStart({
    player,
    action,
    diceUsed: dice,
    budget: { ...budget },
    destinations: [],
    locked: true,
    movedUnitIds: [],
    moveCount: 0,
  })
}

interface ExecuteActionParams {
  step: ProcedureStep
  activePlayer: PlayerId
  nextActions: NextActions
  movementState: MovementState | null
  diceSlots: DiceSlotState[]
  gatherDiceTypes: (action: ActionType) => DiceType[] | null
  onStartRoll: (player: PlayerId, action: ActionType, dice: DiceType[]) => void
  setDiceSlots: (slots: DiceSlotState[]) => void
  openRedistribution: (config: DiceRedistributionState) => void
  setRedistributionChoice: (choice: DiceRedistributionState['options'][number]) => void
}

export const executeAction = ({
  step,
  activePlayer,
  nextActions,
  movementState,
  diceSlots,
  gatherDiceTypes,
  onStartRoll,
  setDiceSlots,
  openRedistribution,
  setRedistributionChoice,
}: ExecuteActionParams) => {
  const actionType = getActionTypeForStep(step)
  if (!actionType) return
  if (nextActions[activePlayer] !== actionType || movementState) {
    playAudio('cancel')
    return
  }
  const dice = gatherDiceTypes(actionType)
  if (!dice) {
    playAudio('cancel')
    return
  }
  onStartRoll(activePlayer, actionType, dice)
  if (actionType === 'standard') {
    const [r1, r2, r3] = diceSlots
    setDiceSlots([
      { id: 'R1', die: r2?.die ?? null },
      { id: 'R2', die: r3?.die ?? null },
      { id: 'R3', die: r1?.die ?? null },
    ])
    return
  }
  if (actionType === 'strategy') {
    const r1Die = diceSlots[0]?.die
    const r2Die = diceSlots[1]?.die
    if (r1Die === 'silver' && r2Die === 'silver') {
      setDiceSlots([
        { id: 'R1', die: 'gold' },
        { id: 'R2', die: 'silver' },
        { id: 'R3', die: 'silver' },
      ])
      return
    }
    openRedistribution({ type: 'strategy', options: ['R2', 'R3'], player: activePlayer })
    setRedistributionChoice('R2')
    return
  }
  openRedistribution({ type: 'comeback', options: ['R1', 'R2', 'R3'], player: activePlayer })
  setRedistributionChoice('R1')
}
