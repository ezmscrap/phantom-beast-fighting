import type {
  DicePlacementStage,
  DiceRedistributionState,
  MovementState,
  NextActions,
  PlacementState,
  PlayerId,
  ProcedureStep,
} from '../../types'

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
