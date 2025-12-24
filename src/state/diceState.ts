import { useCallback, useState } from 'react'
import { dicePlacementOrder } from '../constants'
import { playAudio } from '../audio'
import type {
  ActionType,
  DicePlacementStage,
  DiceRedistributionState,
  DiceSlotState,
  DiceType,
} from '../types'

const diceSlotIds: DiceSlotState['id'][] = ['R1', 'R2', 'R3']

const createInitialSlots = (): DiceSlotState[] => diceSlotIds.map((id) => ({ id, die: null }))

export const useDiceState = () => {
  const [diceSlots, setDiceSlots] = useState<DiceSlotState[]>(createInitialSlots)
  const [dicePlacementStage, setDicePlacementStage] = useState<DicePlacementStage>(0)
  const [diceRedistribution, setDiceRedistribution] = useState<DiceRedistributionState | null>(null)
  const [redistributionChoice, setRedistributionChoice] = useState<DiceSlotState['id']>('R1')

  const placeDie = useCallback(
    (slotId: DiceSlotState['id']) => {
      if (dicePlacementStage >= dicePlacementOrder.length) return
      const targetSlot = diceSlots.find((slot) => slot.id === slotId)
      if (!targetSlot || targetSlot.die) return
      const nextDie = dicePlacementOrder[dicePlacementStage]
      setDiceSlots((prev) =>
        prev.map((slot) => (slot.id === slotId && !slot.die ? { ...slot, die: nextDie } : slot)),
      )
      playAudio('dicePlace')
      setDicePlacementStage((prev) => ((prev + 1) as DicePlacementStage))
    },
    [dicePlacementStage, diceSlots],
  )

  const gatherDiceTypes = useCallback(
    (action: ActionType): DiceType[] | null => {
      const [r1, r2, r3] = diceSlots
      if (action === 'standard') {
        return r1?.die ? [r1.die] : null
      }
      if (action === 'strategy') {
        return r1?.die && r2?.die ? [r1.die, r2.die] : null
      }
      return r1?.die && r2?.die && r3?.die ? [r1.die, r2.die, r3.die] : null
    },
    [diceSlots],
  )

  const completeRedistribution = useCallback(() => {
    if (!diceRedistribution) return
    if (diceRedistribution.type === 'strategy') {
      const goldSlot = redistributionChoice === 'R2' ? 'R2' : 'R3'
      setDiceSlots([
        { id: 'R1', die: 'silver' },
        { id: 'R2', die: goldSlot === 'R2' ? 'gold' : 'silver' },
        { id: 'R3', die: goldSlot === 'R3' ? 'gold' : 'silver' },
      ])
    } else {
      setDiceSlots([
        { id: 'R1', die: redistributionChoice === 'R1' ? 'gold' : 'silver' },
        { id: 'R2', die: redistributionChoice === 'R2' ? 'gold' : 'silver' },
        { id: 'R3', die: redistributionChoice === 'R3' ? 'gold' : 'silver' },
      ])
    }
    setDiceRedistribution(null)
  }, [diceRedistribution, redistributionChoice])

  const resetDiceState = useCallback(() => {
    setDiceSlots(createInitialSlots())
    setDicePlacementStage(0)
    setDiceRedistribution(null)
    setRedistributionChoice('R1')
  }, [])

  return {
    diceSlots,
    dicePlacementStage,
    diceRedistribution,
    redistributionChoice,
    setRedistributionChoice,
    setDiceRedistribution,
    setDiceSlots,
    setDicePlacementStage,
    placeDie,
    gatherDiceTypes,
    completeRedistribution,
    resetDiceState,
  }
}
