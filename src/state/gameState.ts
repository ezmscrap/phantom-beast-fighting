import { useCallback, useState } from 'react'
import type { PlayerId, ProcedureStep } from '../types'
import { useUnitLogic } from './game/useUnitLogic'
import { useMovementLogic } from './game/useMovementLogic'
import { useActionPlanLogic } from './game/useActionPlanLogic'
export { createUnitLabel } from './game/helpers'

export const useGameState = () => {
  const {
    players,
    setPlayers,
    units,
    setUnits,
    placementState,
    setPlacementState,
    creationRequest,
    setCreationRequest,
    creationSelection,
    setCreationSelection,
    miniBoardState,
    setMiniBoardState,
    victor,
    setVictor,
    boardMap,
    remainingByClass,
    creationRemaining,
    activePlacementUnits,
    currentPlacementTargets,
    increaseEnergy,
    decreaseEnergy,
    handleCreateUnit,
    handlePlaceUnit,
    handleSwapSelection,
    placementSelectionHandler,
    toggleSwapMode,
    handleMiniBoardClick,
    cancelMiniBoard,
    handleRemoveUnit,
    resetUnitState,
  } = useUnitLogic()

  const {
    actionSelection,
    setActionSelection,
    nextActions,
    setNextActions,
    handleActionSelection,
    confirmAction,
    resetActionPlan,
  } = useActionPlanLogic({ players, decreaseEnergy })

  const {
    movementState,
    setMovementState,
    activeMovementUnits,
    handleSelectUnitForMovement,
    handleMoveUnit,
    resetMovementState,
  } = useMovementLogic({
    units,
    setUnits,
    boardMap,
    increaseEnergy,
    handleRemoveUnit,
    setNextActions,
  })

  const [step, setStep] = useState<ProcedureStep>(1)
  const [leadingPlayer, setLeadingPlayer] = useState<PlayerId>('A')
  const [nameStage, setNameStage] = useState<'names' | 'confirmNames' | 'initiative' | 'confirmInitiative'>('names')
  const [nameDrafts, setNameDrafts] = useState({ A: 'プレイヤーA', B: 'プレイヤーB' })
  const [nameLocks, setNameLocks] = useState({ A: false, B: false })
  const [initiativeChoice, setInitiativeChoice] = useState<PlayerId>('A')

  const goToNextStep = useCallback(() => {
    setStep((prev) => {
      if (prev === 16) {
        return 7
      }
      return ((prev + 1) as ProcedureStep)
    })
  }, [])

  const resetGame = () => {
    resetUnitState()
    resetMovementState()
    resetActionPlan()
    setStep(1)
    setLeadingPlayer('A')
    setNameStage('names')
    setNameLocks({ A: false, B: false })
    setNameDrafts({ A: 'プレイヤーA', B: 'プレイヤーB' })
    setInitiativeChoice('A')
  }

  return {
    players,
    units,
    step,
    leadingPlayer,
    placementState,
    movementState,
    actionSelection,
    nextActions,
    creationRequest,
    creationSelection,
    miniBoardState,
    nameStage,
    nameDrafts,
    nameLocks,
    initiativeChoice,
    victor,
    boardMap,
    remainingByClass,
    activePlacementUnits,
    currentPlacementTargets,
    creationRemaining,
    activeMovementUnits,
    setPlayers,
    setUnits,
    setStep,
    setLeadingPlayer,
    setNameStage,
    setNameDrafts,
    setNameLocks,
    setInitiativeChoice,
    setCreationRequest,
    setCreationSelection,
    setPlacementState,
    setMiniBoardState,
    setMovementState,
    setActionSelection,
    setNextActions,
    setVictor,
    handleCreateUnit,
    handlePlaceUnit,
    handleSelectUnitForMovement,
    handleMoveUnit,
    handleActionSelection,
    confirmAction,
    handleMiniBoardClick,
    cancelMiniBoard,
    handleSwapSelection,
    placementSelectionHandler,
    toggleSwapMode,
    goToNextStep,
    resetGame,
  }
}
