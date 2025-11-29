import { useCallback, useState } from 'react'
import { actionCosts } from '../../constants'
import { playAudio } from '../../audio'
import type { ActionSelectionState, ActionType, NextActions, PlayerId, PlayerState } from '../../types'

interface UseActionPlanLogicOptions {
  players: Record<PlayerId, PlayerState>
  decreaseEnergy: (player: PlayerId, amount: number) => void
}

export const useActionPlanLogic = ({ players, decreaseEnergy }: UseActionPlanLogicOptions) => {
  const [actionSelection, setActionSelection] = useState<ActionSelectionState | null>(null)
  const [nextActions, setNextActions] = useState<NextActions>({ A: null, B: null })

  const handleActionSelection = useCallback((player: PlayerId, value: ActionType) => {
    setActionSelection({ player, value })
    playAudio('radio')
  }, [])

  const confirmAction = useCallback(() => {
    if (!actionSelection) return
    const { player, value } = actionSelection
    const cost = actionCosts[value]
    if (players[player].energy < cost) {
      playAudio('cancel')
      return
    }
    if (cost > 0) {
      decreaseEnergy(player, cost)
    }
    const updated = {
      A: player === 'A' ? value : nextActions.A,
      B: player === 'B' ? value : nextActions.B,
    }
    console.debug('confirmAction nextActions update', updated)
    setNextActions(updated)
    setActionSelection(null)
    playAudio('button')
  }, [actionSelection, players, decreaseEnergy, nextActions])

  const resetActionPlan = useCallback(() => {
    setActionSelection(null)
    setNextActions({ A: null, B: null })
  }, [])

  return {
    actionSelection,
    setActionSelection,
    nextActions,
    setNextActions,
    handleActionSelection,
    confirmAction,
    resetActionPlan,
  }
}
