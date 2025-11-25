import { playAudio } from '../audio'
import type {
  ActionType,
  DicePlacementStage,
  DiceRedistributionState,
  DiceSlotState,
  DiceType,
  MovementState,
  NextActions,
  PlayerId,
  PlacementState,
  ProcedureStep,
} from '../types'

const actionMap: Partial<Record<ProcedureStep, ActionType>> = {
  8: 'standard',
  9: 'strategy',
  10: 'comeback',
  13: 'standard',
  14: 'strategy',
  15: 'comeback',
}

const actionLabels: Record<ActionType, string> = {
  standard: '通常アクション',
  strategy: '作戦アクション',
  comeback: '起死回生アクション',
}

export const getActionTypeForStep = (step: ProcedureStep): ActionType | null => actionMap[step] ?? null

export const getActionLabel = (action: ActionType) => actionLabels[action]

export const getStepActionInfo = (step: ProcedureStep) => {
  const type = getActionTypeForStep(step)
  return type ? { type, label: actionLabels[type] } : null
}

export const getActivePlayerForStep = (step: ProcedureStep, leadingPlayer: PlayerId): PlayerId => {
  switch (step) {
    case 2:
    case 4:
    case 6:
    case 7:
    case 8:
    case 9:
    case 10:
    case 11:
      return leadingPlayer
    case 3:
    case 5:
    case 12:
    case 13:
    case 14:
    case 15:
    case 16:
      return leadingPlayer === 'A' ? 'B' : 'A'
    default:
      return leadingPlayer
  }
}

interface CanAdvanceParams {
  step: ProcedureStep
  diceRedistribution: DiceRedistributionState | null
  placementState: PlacementState | null
  pendingCreations: Record<number, number>
  pendingPlacementCount: number
  dicePlacementStage: DicePlacementStage
  movementState: MovementState | null
  nextActions: NextActions
  activeStepPlayer: PlayerId
}

export const canAdvanceStep = ({
  step,
  diceRedistribution,
  placementState,
  pendingCreations,
  dicePlacementStage,
  pendingPlacementCount,
  movementState,
  nextActions,
  activeStepPlayer,
}: CanAdvanceParams) => {
  if (step === 1 || diceRedistribution) return false
  if (step >= 2 && step <= 5) {
    return (
      placementState === null &&
      pendingCreations[step as 2 | 3 | 4 | 5] === 0 &&
      pendingPlacementCount === 0
    )
  }
  if (step === 6) {
    return dicePlacementStage === 3
  }
  if ([8, 9, 10, 13, 14, 15].includes(step)) {
    if (movementState) return false
    return nextActions[activeStepPlayer] === null
  }
  if ([7, 12].includes(step)) {
    return nextActions[activeStepPlayer] !== null
  }
  if ([11, 16].includes(step)) {
    return true
  }
  return !movementState
}

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
  } else if (actionType === 'strategy') {
    const r1Die = diceSlots[0]?.die
    const r2Die = diceSlots[1]?.die
    if (r1Die === 'silver' && r2Die === 'silver') {
      setDiceSlots([
        { id: 'R1', die: 'gold' },
        { id: 'R2', die: 'silver' },
        { id: 'R3', die: 'silver' },
      ])
    } else {
      openRedistribution({ type: 'strategy', options: ['R2', 'R3'], player: activePlayer })
      setRedistributionChoice('R2')
    }
  } else {
    openRedistribution({ type: 'comeback', options: ['R1', 'R2', 'R3'], player: activePlayer })
    setRedistributionChoice('R1')
  }
}
