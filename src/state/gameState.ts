import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  INITIAL_BASE_CARDS,
  INITIAL_CLASS_CARDS,
  actionCosts,
  baseDisplayNames,
  baseMoveAudio,
  classAttackAudio,
  classDisplayNames,
  columns,
  placementRows,
  rows,
} from '../constants'
import { playAudio } from '../audio'
import { buildBoardMap, computeLegalMoves } from '../logic/movement'
import type {
  ActionSelectionState,
  ActionType,
  BaseType,
  BoardCell,
  ClassType,
  MiniBoardState,
  MovementBudget,
  MovementState,
  NextActions,
  PlacementState,
  PlayerId,
  ProcedureStep,
  Unit,
} from '../types'

const creationRequirements: Record<2 | 3 | 4 | 5, number> = { 2: 3, 3: 3, 4: 2, 5: 2 }

const createInitialPlayers = () => ({
  A: {
    id: 'A' as PlayerId,
    name: 'プレイヤーA',
    color: 'white' as const,
    energy: 0,
    baseCards: { ...INITIAL_BASE_CARDS },
    classCards: { ...INITIAL_CLASS_CARDS },
  },
  B: {
    id: 'B' as PlayerId,
    name: 'プレイヤーB',
    color: 'black' as const,
    energy: 0,
    baseCards: { ...INITIAL_BASE_CARDS },
    classCards: { ...INITIAL_CLASS_CARDS },
  },
})

const opponentOf = (player: PlayerId): PlayerId => (player === 'A' ? 'B' : 'A')

export const createUnitLabel = (unit: Unit) => `${baseDisplayNames[unit.base]}${classDisplayNames[unit.role]}`

export const useGameState = () => {
  const [players, setPlayers] = useState(() => createInitialPlayers())
  const [units, setUnits] = useState<Unit[]>([])
  const [unitCounter, setUnitCounter] = useState(0)
  /** 現在の手順（1〜16）。ゲーム進行やボタン表示の基準になる。 */
  const [step, setStep] = useState<ProcedureStep>(1)
  const [leadingPlayer, setLeadingPlayer] = useState<PlayerId>('A')
  const [placementState, setPlacementState] = useState<PlacementState | null>(null)
  const [movementState, setMovementState] = useState<MovementState | null>(null)
  /** 次アクション選択モーダルで一時的に保持するラジオ選択内容。 */
  const [actionSelection, setActionSelection] = useState<ActionSelectionState | null>(null)
  /** エネルギー消費決定後に確定した各プレイヤーの次アクション。 */
  const [nextActions, setNextActions] = useState<NextActions>({ A: null, B: null })
  const [creationRequest, setCreationRequest] = useState<{ player: PlayerId; step: ProcedureStep } | null>(null)
  const [creationSelection, setCreationSelection] = useState<{ base?: BaseType; role?: ClassType }>({})
  const [miniBoardState, setMiniBoardState] = useState<MiniBoardState | null>(null)
  const [nameStage, setNameStage] = useState<'names' | 'confirmNames' | 'initiative' | 'confirmInitiative'>('names')
  const [nameDrafts, setNameDrafts] = useState({ A: 'プレイヤーA', B: 'プレイヤーB' })
  const [nameLocks, setNameLocks] = useState({ A: false, B: false })
  const [initiativeChoice, setInitiativeChoice] = useState<PlayerId>('A')
  const [victor, setVictor] = useState<PlayerId | null>(null)

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
    const base = { 2: 0, 3: 0, 4: 0, 5: 0 }
    return units.reduce((acc, unit) => {
      if (unit.createdAtStep && acc[unit.createdAtStep as 2 | 3 | 4 | 5] !== undefined) {
        acc[unit.createdAtStep as 2 | 3 | 4 | 5] += 1
      }
      return acc
    }, { ...base })
  }, [units])

  const creationRemaining = useMemo(() => {
    const steps: Array<2 | 3 | 4 | 5> = [2, 3, 4, 5]
    return steps.reduce((acc, stepKey) => {
      const required = creationRequirements[stepKey]
      acc[stepKey] = Math.max(0, required - creationProgress[stepKey])
      return acc
    }, { ...creationRequirements } as Record<2 | 3 | 4 | 5, number>)
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

  const activeMovementUnits = useMemo(() => {
    if (!movementState) return []
    return units.filter(
      (unit) =>
        unit.owner === movementState.player &&
        unit.status === 'deployed' &&
        movementState.budget[unit.role] > 0,
    )
  }, [units, movementState])

  const handleCreateUnit = (player: PlayerId, base: BaseType, role: ClassType, stepTag?: ProcedureStep) => {
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
  }

  const handlePlaceUnit = (unitId: string, cell: BoardCell) => {
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
  }

  const increaseEnergy = (player: PlayerId, amount = 1) => {
    setPlayers((prev) => ({
      ...prev,
      [player]: { ...prev[player], energy: Math.min(3, prev[player].energy + amount) },
    }))
  }

  const decreaseEnergy = (player: PlayerId, amount: number) => {
    setPlayers((prev) => ({
      ...prev,
      [player]: { ...prev[player], energy: Math.max(0, prev[player].energy - amount) },
    }))
  }

  const handleRemoveUnit = (unit: Unit) => {
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
        setVictor(opponentOf(unit.owner))
      }
      return next
    })
    increaseEnergy(unit.owner)
  }

  const handleSelectUnitForMovement = (unit: Unit) => {
    if (!movementState) return
    const classBudget = movementState.budget[unit.role]
    if (classBudget <= 0 || unit.owner !== movementState.player || unit.status !== 'deployed') return
    const wrap = unit.role === 'mage'
    const moves = computeLegalMoves(unit, boardMap, wrap)
    setMovementState({ ...movementState, selectedUnitId: unit.id, destinations: moves })
    playAudio(baseMoveAudio[unit.base])
  }

  const handleMoveUnit = (cell: BoardCell) => {
    if (!movementState || !movementState.selectedUnitId) return
    const movingUnit = units.find((unit) => unit.id === movementState.selectedUnitId)
    if (!movingUnit) return
    const legal = movementState.destinations.includes(cell)
    if (!legal) return
    const occupant = boardMap.get(cell)
    setUnits((prev) =>
      prev.map((unit) => {
        if (unit.id === movingUnit.id) {
          return { ...unit, position: cell, status: 'deployed' as const }
        }
        return unit
      }),
    )
    const nextBudget: MovementBudget = {
      ...movementState.budget,
      [movingUnit.role]: movementState.budget[movingUnit.role] - 1,
    }
    if (movingUnit.role === 'tactician') {
      increaseEnergy(movingUnit.owner)
    }
    if (occupant && occupant.owner !== movingUnit.owner) {
      handleRemoveUnit(occupant)
      playAudio(classAttackAudio[movingUnit.role])
      nextBudget.swordsman = 0
      nextBudget.mage = 0
      nextBudget.tactician = 0
    }
    const completed = nextBudget.swordsman === 0 && nextBudget.mage === 0 && nextBudget.tactician === 0
    setMovementState(
      completed
        ? null
        : {
            ...movementState,
            budget: nextBudget,
            selectedUnitId: undefined,
            destinations: [],
          },
    )
    if (completed) {
      setNextActions((prev) => ({ ...prev, [movementState.player]: null }))
    }
  }

  const goToNextStep = useCallback(() => {
    setStep((prev) => {
      if (prev === 16) {
        return 7
      }
      return ((prev + 1) as ProcedureStep)
    })
  }, [])

  const placementSelectionHandler = (unitId: string) => {
    if (!placementState) return
    setPlacementState({ ...placementState, selectedUnitId: unitId })
    setMiniBoardState({ mode: 'placement', player: placementState.player })
  }

  const handleSwapUnits = (firstId: string, secondId: string) => {
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
  }

  const handleSwapSelection = (unitId: string) => {
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
  }

  const handleMiniBoardClick = (cell: BoardCell) => {
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
  }

  const cancelMiniBoard = () => {
    setMiniBoardState((state) => {
      if (state?.mode === 'placement') {
        setPlacementState((prev) => (prev ? { ...prev, selectedUnitId: undefined } : prev))
      } else if (state?.mode === 'swap') {
        setPlacementState((prev) => (prev ? { ...prev, swapSelection: [] } : prev))
      }
      return null
    })
    playAudio('cancel')
  }

  /**
   * 次アクション選択モーダルでラジオを選んだ時に呼ばれる。
   * 一時的に actionSelection に保持し、モーダル確定時に nextActions へ反映する。
   */
  const handleActionSelection = (player: PlayerId, value: ActionType) => {
    setActionSelection({ player, value })
    playAudio('radio')
  }

  /**
   * 次アクション選択モーダルの「決定」ボタン。
   * 選択内容があれば energy を消費し、nextActionsへ確定値をセットする。
   */
  const confirmAction = () => {
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
    setNextActions((prev) => ({ ...prev, [player]: value }))
    setActionSelection(null)
    playAudio('button')
  }

  const resetGame = () => {
    setPlayers(createInitialPlayers())
    setUnits([])
    setUnitCounter(0)
    setStep(1)
    setLeadingPlayer('A')
    setNextActions({ A: null, B: null })
    setCreationRequest(null)
    setCreationSelection({})
    setMovementState(null)
    setPlacementState(null)
    setActionSelection(null)
    setMiniBoardState(null)
    setNameStage('names')
    setNameLocks({ A: false, B: false })
    setNameDrafts({ A: 'プレイヤーA', B: 'プレイヤーB' })
    setInitiativeChoice('A')
    setVictor(null)
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
    activeMovementUnits,
    creationRemaining,
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
    goToNextStep,
    resetGame,
  }
}
