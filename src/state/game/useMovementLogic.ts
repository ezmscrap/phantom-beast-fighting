import { useCallback, useEffect, useMemo, useState } from 'react'
import { baseMoveAudio, classAttackAudio } from '../../constants'
import { playAudio } from '../../audio'
import { computeLegalMoves } from '../../logic/movement'
import type {
  BoardCell,
  ClassType,
  GameLogEntry,
  MovementBudget,
  MovementState,
  PlayerId,
  ProcedureStep,
  Unit,
} from '../../types'
import { collectDeployedUnitIds } from './utils'

const CLASS_TYPES: ClassType[] = ['swordsman', 'mage', 'tactician']

const MOVEMENT_LIMITS: Partial<Record<'strategy' | 'comeback' | 'standard', number>> = {
  strategy: 1,
  comeback: 2,
}

const getMovementLimit = (action: MovementState['action']) => MOVEMENT_LIMITS[action] ?? null

const hasReachedMovementLimit = (state: MovementState, moveCount?: number) => {
  const limit = getMovementLimit(state.action)
  if (limit == null) return false
  const effectiveCount = typeof moveCount === 'number' ? moveCount : state.moveCount
  return effectiveCount >= limit
}

interface MovementLogicOptions {
  units: Unit[]
  setUnits: React.Dispatch<React.SetStateAction<Unit[]>>
  boardMap: Map<BoardCell, Unit>
  increaseEnergy: (player: PlayerId, amount?: number) => void
  handleRemoveUnit: (unit: Unit, causedBy: PlayerId) => void
  setNextActions: React.Dispatch<React.SetStateAction<Record<PlayerId, MovementState['action'] | null>>>
  queueLog?: (entry: Omit<GameLogEntry, 'id' | 'timestamp' | 'beforeState' | 'afterState'>) => void
  getCurrentStep?: () => ProcedureStep
}

export const useMovementLogic = ({
  units,
  setUnits,
  boardMap,
  increaseEnergy,
  handleRemoveUnit,
  setNextActions,
  queueLog,
  getCurrentStep,
}: MovementLogicOptions) => {
  const [movementState, setMovementState] = useState<MovementState | null>(null)

  const logAction = useCallback(
    (meta: Omit<GameLogEntry, 'id' | 'timestamp' | 'beforeState' | 'afterState' | 'step'>) => {
      const stepValue = getCurrentStep?.() ?? 1
      queueLog?.({ ...meta, step: stepValue })
    },
    [queueLog, getCurrentStep],
  )

  const isRoleMovementComplete = useCallback(
    (state: MovementState, role: ClassType, movedIds?: string[]) => {
      if (state.budget[role] <= 0) return true
      const used = movedIds ?? state.movedUnitIds
      return !units.some(
        (unit) =>
          unit.owner === state.player &&
          unit.status === 'deployed' &&
          unit.role === role &&
          !used.includes(unit.id),
      )
    },
    [units],
  )

  const areAllRolesComplete = useCallback(
    (state: MovementState, movedIds?: string[]) =>
      CLASS_TYPES.every((role) => isRoleMovementComplete(state, role, movedIds)),
    [isRoleMovementComplete],
  )

  useEffect(() => {
    if (!movementState || movementState.locked) return
    if (areAllRolesComplete(movementState)) {
      const completedPlayer = movementState.player
      setMovementState(null)
      setNextActions((prev) => ({ ...prev, [completedPlayer]: null }))
    }
  }, [movementState, areAllRolesComplete, setNextActions])

  const activeMovementUnits = useMemo(() => {
    if (!movementState) return []
    const moveLimitReached = hasReachedMovementLimit(movementState)
    return units.filter(
      (unit) =>
        unit.owner === movementState.player &&
        unit.status === 'deployed' &&
        movementState.budget[unit.role] > 0 &&
        !movementState.movedUnitIds.includes(unit.id) &&
        !isRoleMovementComplete(movementState, unit.role) &&
        !moveLimitReached,
    )
  }, [units, movementState, isRoleMovementComplete])

  const handleSelectUnitForMovement = useCallback(
    (unit: Unit) => {
      if (!movementState) return
      if (hasReachedMovementLimit(movementState)) return
      const classBudget = movementState.budget[unit.role]
      if (
        classBudget <= 0 ||
        unit.owner !== movementState.player ||
        unit.status !== 'deployed' ||
        movementState.movedUnitIds.includes(unit.id) ||
        isRoleMovementComplete(movementState, unit.role)
      ) {
        return
      }
      const wrap = unit.role === 'mage'
      const moves = computeLegalMoves(unit, boardMap, wrap)
      setMovementState({ ...movementState, selectedUnitId: unit.id, destinations: moves })
      playAudio('dicePlace')
    },
    [movementState, boardMap, isRoleMovementComplete],
  )

  const handleMoveUnit = useCallback(
    (cell: BoardCell) => {
      if (!movementState || !movementState.selectedUnitId) return
      const movingUnit = units.find((unit) => unit.id === movementState.selectedUnitId)
      if (!movingUnit) return
      if (movementState.movedUnitIds.includes(movingUnit.id)) return
      const legal = movementState.destinations.includes(cell)
      if (!legal) return
      const occupant = boardMap.get(cell)
      logAction({ actor: movementState.player, action: 'moveUnit', detail: `${movingUnit.id}:${movingUnit.position ?? ''}->${cell}` })
      setUnits((prev) =>
        prev.map((unit) => {
          if (unit.id === movingUnit.id) {
            return { ...unit, position: cell, status: 'deployed' as const }
          }
          return unit
        }),
      )
      playAudio(baseMoveAudio[movingUnit.base])
      const nextBudget: MovementBudget = {
        ...movementState.budget,
        [movingUnit.role]: movementState.budget[movingUnit.role] - 1,
      }
      let updatedMoved =
        movementState.movedUnitIds.includes(movingUnit.id)
          ? movementState.movedUnitIds
          : [...movementState.movedUnitIds, movingUnit.id]
      if (movingUnit.role === 'tactician') {
        increaseEnergy(movingUnit.owner)
      }
      if (occupant && occupant.owner !== movingUnit.owner) {
        handleRemoveUnit(occupant, movingUnit.owner)
        playAudio(classAttackAudio[movingUnit.role])
      }
      const nextMoveCount = movementState.moveCount + 1
      const limitReachedAfterMove = hasReachedMovementLimit(movementState, nextMoveCount)
      if (limitReachedAfterMove) {
        const allPlayerUnits = collectDeployedUnitIds(units, movementState.player)
        const union = new Set([...updatedMoved, ...allPlayerUnits])
        updatedMoved = Array.from(union)
      }
      const nextStateForCheck: MovementState = {
        ...movementState,
        budget: nextBudget,
        movedUnitIds: updatedMoved,
        moveCount: nextMoveCount,
      }
      const completed = areAllRolesComplete(nextStateForCheck)
      setMovementState(
        completed
          ? null
          : {
              ...nextStateForCheck,
              selectedUnitId: undefined,
              destinations: [],
            },
      )
      if (completed) {
        setNextActions((prev) => ({ ...prev, [movementState.player]: null }))
      }
    },
    [
      movementState,
      units,
      boardMap,
      increaseEnergy,
      handleRemoveUnit,
      areAllRolesComplete,
      setNextActions,
      setUnits,
    ],
  )

  const resetMovementState = useCallback(() => setMovementState(null), [])

  return {
    movementState,
    setMovementState,
    activeMovementUnits,
    handleSelectUnitForMovement,
    handleMoveUnit,
    resetMovementState,
  }
}
