import { useCallback, useEffect, useMemo, useState } from 'react'
import { columns, placementRows, rows } from '../../constants'
import type {
  BaseType,
  BoardCell,
  ClassType,
  MiniBoardState,
  PlacementState,
  PlayerId,
  ProcedureStep,
  Unit,
} from '../../types'
import { playAudio } from '../../audio'
import { buildBoardMap } from '../../logic/movement'
import { createInitialPlayers, opponentOf } from './helpers'

const creationRequirements: Record<2 | 3 | 4, number> = { 2: 3, 3: 5, 4: 2 }

export const useUnitLogic = () => {
  const [players, setPlayers] = useState(createInitialPlayers)
  const [units, setUnits] = useState<Unit[]>([])
  const [unitCounter, setUnitCounter] = useState(0)
  const [placementState, setPlacementState] = useState<PlacementState | null>(null)
  const [creationRequest, setCreationRequest] = useState<{ player: PlayerId; step: ProcedureStep } | null>(null)
  const [creationSelection, setCreationSelection] = useState<{ base?: BaseType; role?: ClassType }>({})
  const [miniBoardState, setMiniBoardState] = useState<MiniBoardState | null>(null)
  const [victor, setVictor] = useState<{ player: PlayerId; reason: ClassType } | null>(null)

  useEffect(() => {
    if (!placementState) {
      setMiniBoardState(null)
    }
  }, [placementState])

  const boardMap = useMemo(() => buildBoardMap(units), [units])

  const remainingByClass = useMemo(() => {
    const template = { swordsman: 0, mage: 0, tactician: 0 }
    return units.reduce(
      (acc, unit) => {
        if (unit.status !== 'removed') {
          acc[unit.owner][unit.role] += 1
        }
        return acc
      },
      {
        A: { ...template },
        B: { ...template },
      },
    )
  }, [units])

  const creationProgress = useMemo(() => {
    const base: Record<2 | 3 | 4, number> = { 2: 0, 3: 0, 4: 0 }
    return units.reduce((acc, unit) => {
      if (unit.createdAtStep && acc[unit.createdAtStep as 2 | 3 | 4] !== undefined) {
        acc[unit.createdAtStep as 2 | 3 | 4] += 1
      }
      return acc
    }, { ...base })
  }, [units])

  const creationRemaining = useMemo(() => {
    const steps: Array<2 | 3 | 4> = [2, 3, 4]
    return steps.reduce((acc, stepKey) => {
      const required = creationRequirements[stepKey]
      acc[stepKey] = Math.max(0, required - creationProgress[stepKey])
      return acc
    }, { ...creationRequirements })
  }, [creationProgress])

  const activePlacementUnits = useMemo(() => {
    if (!placementState) return []
    return units.filter((unit) => unit.owner === placementState.player && unit.status === 'preDeployment')
  }, [placementState, units])

  const currentPlacementTargets = useMemo(() => {
    if (!placementState || !placementState.selectedUnitId) return []
    const targetRow = placementRows[placementState.player] - 1
    return columns
      .map((col) => `${col}${rows[targetRow]}` as BoardCell)
      .filter((cell) => {
        const occupant = boardMap.get(cell)
        return !(occupant && occupant.owner === placementState.player)
      })
  }, [placementState, boardMap])

  const increaseEnergy = useCallback((player: PlayerId, amount = 1) => {
    setPlayers((prev) => ({
      ...prev,
      [player]: { ...prev[player], energy: Math.min(3, prev[player].energy + amount) },
    }))
  }, [])

  const decreaseEnergy = useCallback((player: PlayerId, amount: number) => {
    setPlayers((prev) => ({
      ...prev,
      [player]: { ...prev[player], energy: Math.max(0, prev[player].energy - amount) },
    }))
  }, [])

  const handleCreateUnit = useCallback(
    (player: PlayerId, base: BaseType, role: ClassType, stepTag?: ProcedureStep) => {
      const owner = players[player]
      if (owner.baseCards[base] <= 0 || owner.classCards[role] <= 0) {
        return
      }
      const newUnit: Unit = {
        id: `unit-${player}-${unitCounter + 1}`,
        owner: player,
        base,
        role,
        status: 'preDeployment' as const,
        createdAtStep: stepTag,
      }
      setUnits((prev) => [...prev, newUnit])
      setUnitCounter((prev) => prev + 1)
      setPlayers((prev) => ({
        ...prev,
        [player]: {
          ...prev[player],
          baseCards: { ...prev[player].baseCards, [base]: prev[player].baseCards[base] - 1 },
          classCards: { ...prev[player].classCards, [role]: prev[player].classCards[role] - 1 },
        },
      }))
      setPlacementState({ player, swapMode: false, swapSelection: [], stepTag })
      playAudio('button')
    },
    [players, unitCounter],
  )

  const handlePlaceUnit = useCallback((unitId: string, cell: BoardCell) => {
    setUnits((prev) =>
      prev.map((unit) => {
        if (unit.id === unitId) {
          return { ...unit, status: 'deployed' as const, position: cell }
        }
        return unit
      }),
    )
    setPlacementState((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        selectedUnitId: undefined,
        swapMode: false,
        swapSelection: [],
      }
    })
    playAudio('unitPlace')
  }, [])

  const handleSwapUnits = useCallback(
    (firstId: string, secondId: string) => {
      const first = units.find((unit) => unit.id === firstId)
      const second = units.find((unit) => unit.id === secondId)
      if (!first?.position || !second?.position) return
      setUnits((prev) =>
        prev.map((unit) => {
          if (unit.id === firstId) {
            return { ...unit, position: second.position }
          }
          if (unit.id === secondId) {
            return { ...unit, position: first.position }
          }
          return unit
        }),
      )
      setPlacementState((prev) => (prev ? { ...prev, swapMode: false, swapSelection: [] } : prev))
      setMiniBoardState((state) => (state?.mode === 'swap' ? null : state))
      playAudio('unitPlace')
    },
    [units],
  )

  const handleSwapSelection = useCallback(
    (unitId: string) => {
      setPlacementState((prev) => {
        if (!prev) return prev
        const already = prev.swapSelection.includes(unitId)
        const nextSelection = already ? prev.swapSelection.filter((id) => id !== unitId) : [...prev.swapSelection, unitId]
        if (nextSelection.length === 2) {
          handleSwapUnits(nextSelection[0], nextSelection[1])
          return { ...prev, swapSelection: [] }
        }
        return { ...prev, swapSelection: nextSelection }
      })
    },
    [handleSwapUnits],
  )

  const placementSelectionHandler = useCallback((unitId: string) => {
    setPlacementState((prev) => {
      if (!prev) return prev
      setMiniBoardState({ mode: 'placement', player: prev.player })
      return { ...prev, selectedUnitId: unitId }
    })
  }, [])

  const handleMiniBoardClick = useCallback(
    (cell: BoardCell) => {
      if (!placementState || !miniBoardState) return
      if (miniBoardState.mode === 'placement') {
        if (!placementState.selectedUnitId) return
        if (!currentPlacementTargets.includes(cell)) return
        handlePlaceUnit(placementState.selectedUnitId, cell)
        setMiniBoardState(null)
        return
      }
      const occupant = boardMap.get(cell)
      if (!occupant || occupant.owner !== miniBoardState.player) return
      const hadOne = placementState.swapSelection.length === 1
      handleSwapSelection(occupant.id)
      if (hadOne) {
        setMiniBoardState(null)
      }
    },
    [placementState, miniBoardState, currentPlacementTargets, boardMap, handlePlaceUnit, handleSwapSelection],
  )

  const cancelMiniBoard = useCallback(() => {
    setMiniBoardState((state) => {
      if (state?.mode === 'placement') {
        setPlacementState((prev) => (prev ? { ...prev, selectedUnitId: undefined } : prev))
      } else if (state?.mode === 'swap') {
        setPlacementState((prev) => (prev ? { ...prev, swapSelection: [] } : prev))
      }
      return null
    })
    playAudio('cancel')
  }, [])

  const handleRemoveUnit = useCallback(
    (unit: Unit) => {
      setUnits((prev) => {
        const next = prev.map((item) =>
          item.id === unit.id ? { ...item, status: 'removed' as const, position: undefined } : item,
        )
        const remainingSameClass = next.filter(
          (item) =>
            item.id !== unit.id &&
            item.owner === unit.owner &&
            item.status !== 'removed' &&
            item.role === unit.role,
        ).length
        if (remainingSameClass <= 0) {
          setVictor({ player: opponentOf(unit.owner), reason: unit.role })
        }
        return next
      })
      increaseEnergy(unit.owner)
    },
    [increaseEnergy],
  )

  const toggleSwapMode = useCallback((enabled: boolean) => {
    setPlacementState((prev) => (prev ? { ...prev, swapMode: enabled, swapSelection: [] } : prev))
  }, [])

  const resetUnitState = useCallback(() => {
    setPlayers(createInitialPlayers())
    setUnits([])
    setUnitCounter(0)
    setPlacementState(null)
    setCreationRequest(null)
    setCreationSelection({})
    setMiniBoardState(null)
    setVictor(null)
  }, [])

  return {
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
  }
}
