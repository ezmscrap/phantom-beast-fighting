import { useEffect, useMemo, useState } from 'react'
import {
  GOLD_FACES,
  INITIAL_BASE_CARDS,
  INITIAL_CLASS_CARDS,
  SILVER_FACES,
  actionCosts,
  baseDisplayNames,
  baseMoveAudio,
  classAttackAudio,
  classDisplayNames,
  columns,
  dicePlacementOrder,
  dragonOffsets,
  griffinOffsets,
  placementRows,
  rows,
  stepDescriptions,
  unicornOffsets,
} from './constants'
import type {
  BaseType,
  BoardCell,
  ClassType,
  DebugDiceSettings,
  DiceType,
  MovementBudget,
  PlayerId,
  ProcedureStep,
  Unit,
} from './types'
import './App.css'
import { Modal } from './components/Modal'
import { DiceRollerOverlay, type DiceVisual } from './components/DiceRollerOverlay'
import { playAudio } from './audio'
import { appConfig, resolvePresetDice } from './config'

const diceSlotIds: Array<'R1' | 'R2' | 'R3'> = ['R1', 'R2', 'R3']

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

const wrapIndex = (value: number, max: number) => ((value % max) + max) % max

const cellToCoords = (cell: BoardCell) => {
  const column = columns.indexOf(cell[0] as never)
  const row = rows.indexOf(Number(cell.slice(1)) as never)
  return { row, column }
}

const coordsToCell = (row: number, column: number): BoardCell | null => {
  if (row < 0 || row >= rows.length || column < 0 || column >= columns.length) {
    return null
  }
  return `${columns[column]}${rows[row]}` as BoardCell
}

type DicePlacementStage = 0 | 1 | 2 | 3

interface PlacementState {
  player: PlayerId
  selectedUnitId?: string
  swapMode: boolean
  swapSelection: string[]
  stepTag?: ProcedureStep
}

interface MovementState {
  player: PlayerId
  budget: MovementBudget
  action: 'standard' | 'strategy' | 'comeback'
  diceUsed: DiceType[]
  selectedUnitId?: string
  destinations: BoardCell[]
  locked: boolean
}

interface ActionSelectionState {
  player: PlayerId
  value: 'standard' | 'strategy' | 'comeback'
}

const initialDiceSlots = diceSlotIds.map((id) => ({ id, die: null as DiceType | null }))

const createUnitLabel = (unit: Unit) => `${baseDisplayNames[unit.base]}${classDisplayNames[unit.role]}`

const computeLegalMoves = (
  unit: Unit,
  board: Map<BoardCell, Unit>,
  wrap: boolean,
): BoardCell[] => {
  const { row, column } = unit.position ? cellToCoords(unit.position) : { row: -1, column: -1 }
  if (row === -1 || column === -1) return []
  const offsets =
    unit.base === 'dragon' ? dragonOffsets : unit.base === 'griffin' ? griffinOffsets : unicornOffsets
  const results: BoardCell[] = []
  const maxRow = rows.length
  const maxCol = columns.length

  const applyWrap = (r: number, c: number) => {
    const y = wrap ? wrapIndex(r, maxRow) : r
    const x = wrap ? wrapIndex(c, maxCol) : c
    if (!wrap && (y < 0 || y >= maxRow || x < 0 || x >= maxCol)) {
      return null
    }
    return coordsToCell(y, x)
  }

  offsets.forEach(([dy, dx]) => {
    const target = applyWrap(row + dy, column + dx)
    if (!target) return
    const occupant = board.get(target)
    if (!occupant || occupant.owner !== unit.owner) {
      results.push(target)
    } else if (unit.base === 'griffin') {
      const dirY = Math.sign(dy)
      const dirX = Math.sign(dx)
      const jumpCell = applyWrap(row + dy + dirY, column + dx + dirX)
      if (!jumpCell) return
      const jumpOccupant = board.get(jumpCell)
      if (!jumpOccupant || jumpOccupant.owner !== unit.owner) {
        results.push(jumpCell)
      }
    }
  })

  return results
}

const rollDiceSet = (dice: DiceType[]) => {
  const visuals: DiceVisual[] = []
  const tallies: MovementBudget = { swordsman: 0, mage: 0, tactician: 0 }
  dice.forEach((type, index) => {
    const definitions = type === 'silver' ? SILVER_FACES : GOLD_FACES
    const faceIndex = Math.floor(Math.random() * definitions.length) as number
    const result = definitions[faceIndex]
    tallies[result] += 1
    visuals.push({ id: `${type}-${index}-${Date.now()}`, type, faceIndex, result })
  })
  return { visuals, tallies }
}

function App() {
  const [players, setPlayers] = useState(() => createInitialPlayers())
  const [units, setUnits] = useState<Unit[]>([])
  const [unitCounter, setUnitCounter] = useState(0)
  const [step, setStep] = useState<ProcedureStep>(1)
  const [leadingPlayer, setLeadingPlayer] = useState<PlayerId>('A')
  const [diceSlots, setDiceSlots] = useState(() => initialDiceSlots.map((slot) => ({ ...slot })))
  const [dicePlacementStage, setDicePlacementStage] = useState<DicePlacementStage>(0)
  const [placementState, setPlacementState] = useState<PlacementState | null>(null)
  const [movementState, setMovementState] = useState<MovementState | null>(null)
  const [diceOverlay, setDiceOverlay] = useState<
    { dice: DiceVisual[]; tallies: MovementBudget; debugSettings?: DebugDiceSettings } | null
  >(null)
  const [actionSelection, setActionSelection] = useState<ActionSelectionState | null>(null)
  const [nextActions, setNextActions] = useState<{ A: 'standard' | 'strategy' | 'comeback' | null; B: 'standard' | 'strategy' | 'comeback' | null }>(
    { A: null, B: null },
  )
  const [creationRequest, setCreationRequest] = useState<{ player: PlayerId; step: ProcedureStep } | null>(null)
  const [creationSelection, setCreationSelection] = useState<{ base?: BaseType; role?: ClassType }>({})
  const [pendingCreations, setPendingCreations] = useState<{ [K in 2 | 3 | 4 | 5]: number }>({
    2: 3,
    3: 3,
    4: 2,
    5: 2,
  })
  const [diceRedistribution, setDiceRedistribution] = useState<{
    type: 'strategy' | 'comeback'
    options: Array<'R1' | 'R2' | 'R3'>
    player: PlayerId
  } | null>(null)
  const [redistributionChoice, setRedistributionChoice] = useState<'R1' | 'R2' | 'R3'>('R1')
  const [miniBoardState, setMiniBoardState] = useState<{ mode: 'placement' | 'swap'; player: PlayerId } | null>(null)
  const [nameStage, setNameStage] = useState<'names' | 'confirmNames' | 'initiative' | 'confirmInitiative'>(
    'names',
  )
  const [nameDrafts, setNameDrafts] = useState({ A: 'プレイヤーA', B: 'プレイヤーB' })
  const [nameLocks, setNameLocks] = useState({ A: false, B: false })
  const [initiativeChoice, setInitiativeChoice] = useState<PlayerId>('A')
  const [victor, setVictor] = useState<PlayerId | null>(null)

  useEffect(() => {
    if (!appConfig.diceDebug.enabled) return
    setPlayers({
      A: {
        id: 'A',
        name: 'テストA',
        color: 'white',
        energy: 0,
        baseCards: { dragon: 0, griffin: 0, unicorn: 0 },
        classCards: { tactician: 0, mage: 0, swordsman: 0 },
      },
      B: {
        id: 'B',
        name: 'テストB',
        color: 'black',
        energy: 0,
        baseCards: { dragon: 0, griffin: 0, unicorn: 0 },
        classCards: { tactician: 0, mage: 0, swordsman: 0 },
      },
    })
    setUnits([
      { id: 'dbg-A1', owner: 'A', base: 'dragon', role: 'mage', status: 'deployed', position: 'A2' },
      { id: 'dbg-A2', owner: 'A', base: 'unicorn', role: 'mage', status: 'deployed', position: 'B2' },
      { id: 'dbg-A3', owner: 'A', base: 'griffin', role: 'swordsman', status: 'deployed', position: 'C2' },
      { id: 'dbg-A4', owner: 'A', base: 'unicorn', role: 'swordsman', status: 'deployed', position: 'D2' },
      { id: 'dbg-A5', owner: 'A', base: 'griffin', role: 'tactician', status: 'deployed', position: 'E2' },
      { id: 'dbg-B1', owner: 'B', base: 'dragon', role: 'mage', status: 'deployed', position: 'A5' },
      { id: 'dbg-B2', owner: 'B', base: 'unicorn', role: 'mage', status: 'deployed', position: 'B5' },
      { id: 'dbg-B3', owner: 'B', base: 'griffin', role: 'swordsman', status: 'deployed', position: 'C5' },
      { id: 'dbg-B4', owner: 'B', base: 'unicorn', role: 'swordsman', status: 'deployed', position: 'D5' },
      { id: 'dbg-B5', owner: 'B', base: 'griffin', role: 'tactician', status: 'deployed', position: 'E5' },
    ])
    setLeadingPlayer('A')
    setStep(8)
    const presetDice = resolvePresetDice(appConfig.diceDebug.preset)
    const visuals: DiceVisual[] = presetDice.map((type, index) => ({
      id: `debug-${type}-${index}`,
      type,
      faceIndex: 0,
      result: 'swordsman',
    }))
    setDiceOverlay({
      dice: visuals,
      tallies: { swordsman: 0, mage: 0, tactician: 0 },
      debugSettings: {
        dieSize: appConfig.diceDebug.dieSize,
        impulse: appConfig.diceDebug.impulse,
      },
    })
  }, [])

  useEffect(() => {
    if (!placementState) {
      setMiniBoardState(null)
    }
  }, [placementState])

  const activePlacementUnits = useMemo(() => {
    if (!placementState) return []
    return units.filter((unit) => unit.owner === placementState.player && unit.status === 'preDeployment')
  }, [placementState, units])

  const boardMap = useMemo(() => {
    const map = new Map<BoardCell, Unit>()
    units.forEach((unit) => {
      if (unit.status === 'deployed' && unit.position) {
        map.set(unit.position, unit)
      }
    })
    return map
  }, [units])

  const remainingByClass = useMemo(() => {
    const template = {
      swordsman: 0,
      mage: 0,
      tactician: 0,
    }
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

  const activeStepPlayer = useMemo(() => {
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
        return opponentOf(leadingPlayer)
      default:
        return leadingPlayer
    }
  }, [step, leadingPlayer])

  const canAdvanceStep = () => {
    if (step === 1 || diceRedistribution) return false
    if (step >= 2 && step <= 5) {
      return placementState === null && pendingCreations[step as 2 | 3 | 4 | 5] === 0
    }
    if (step === 6) {
      return dicePlacementStage === 3
    }
    if ([8, 9, 10, 13, 14, 15].includes(step)) {
      const targetPlayer = activeStepPlayer
      if (movementState) return false
      return nextActions[targetPlayer] === null
    }
    if ([7, 12].includes(step)) {
      return nextActions[activeStepPlayer] !== null
    }
    if ([11, 16].includes(step)) {
      return true
    }
    return !movementState
  }

  const goToNextStep = () => {
  if (step === 16) {
    setStep(7)
    return
  }
  setStep((step + 1) as ProcedureStep)
}

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
      status: 'preDeployment',
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

  const markCreationComplete = (stepTag?: ProcedureStep) => {
    if (!stepTag || ![2, 3, 4, 5].includes(stepTag)) return
    setPendingCreations((prev) => ({
      ...prev,
      [stepTag]: Math.max(0, prev[stepTag as 2 | 3 | 4 | 5] - 1),
    }))
  }

  const handlePlaceUnit = (unitId: string, cell: BoardCell) => {
    setUnits((prev) =>
      prev.map((unit) => {
        if (unit.id === unitId) {
          return { ...unit, status: 'deployed', position: cell }
        }
        return unit
      }),
    )
    markCreationComplete(placementState?.stepTag)
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
    setUnits((prev) => prev.map((item) => (item.id === unit.id ? { ...item, status: 'removed', position: undefined } : item)))
    increaseEnergy(unit.owner)
    const remainingSameClass = units.filter(
      (item) => item.id !== unit.id && item.owner === unit.owner && item.status !== 'removed' && item.role === unit.role,
    ).length
    if (remainingSameClass <= 0) {
      setVictor(opponentOf(unit.owner))
    }
  }

  const startDiceRoll = (player: PlayerId, action: 'standard' | 'strategy' | 'comeback', dice: DiceType[]) => {
    if (!dice.length) return
    playAudio(dice.length === 1 ? 'diceSingle' : 'diceMulti')
    const roll = rollDiceSet(dice)
    setDiceOverlay({ dice: roll.visuals, tallies: roll.tallies })
    setMovementState({
      player,
      action,
      diceUsed: dice,
      budget: { ...roll.tallies },
      destinations: [],
      locked: true,
    })
  }

  const gatherDiceTypes = (action: 'standard' | 'strategy' | 'comeback'): DiceType[] | null => {
    const [r1, r2, r3] = diceSlots
    if (action === 'standard') {
      return r1.die ? [r1.die] : null
    }
    if (action === 'strategy') {
      return r1.die && r2.die ? [r1.die, r2.die] : null
    }
    return r1.die && r2.die && r3.die ? [r1.die, r2.die, r3.die] : null
  }

  const completeRedistribution = () => {
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
  }

  const executeAction = (currentStep: ProcedureStep) => {
    const actionMap: Partial<Record<ProcedureStep, 'standard' | 'strategy' | 'comeback'>> = {
      8: 'standard',
      9: 'strategy',
      10: 'comeback',
      13: 'standard',
      14: 'strategy',
      15: 'comeback',
    }
    const actionType = actionMap[currentStep]
    if (!actionType) return
    const player = activeStepPlayer
    if (nextActions[player] !== actionType || movementState) {
      playAudio('cancel')
      return
    }
    const dice = gatherDiceTypes(actionType)
    if (!dice) {
      playAudio('cancel')
      return
    }
    startDiceRoll(player, actionType, dice)
    if (actionType === 'standard') {
      const [r1, r2, r3] = diceSlots
      setDiceSlots([
        { id: 'R1', die: r2.die },
        { id: 'R2', die: r3.die },
        { id: 'R3', die: r1.die },
      ])
    } else if (actionType === 'strategy') {
      const r1Die = diceSlots[0].die
      const r2Die = diceSlots[1].die
      if (r1Die === 'silver' && r2Die === 'silver') {
        setDiceSlots([
          { id: 'R1', die: 'gold' },
          { id: 'R2', die: 'silver' },
          { id: 'R3', die: 'silver' },
        ])
      } else {
        setDiceRedistribution({ type: 'strategy', options: ['R2', 'R3'], player })
        setRedistributionChoice('R2')
      }
    } else {
      setDiceRedistribution({ type: 'comeback', options: ['R1', 'R2', 'R3'], player })
      setRedistributionChoice('R1')
    }
  }

  const confirmDiceResult = () => {
    setDiceOverlay(null)
    setMovementState((state) => {
      if (!state) return state
      const noBudget = state.budget.swordsman === 0 && state.budget.mage === 0 && state.budget.tactician === 0
      if (noBudget) {
        setNextActions((prev) => ({ ...prev, [state.player]: null }))
        return null
      }
      return { ...state, locked: false }
    })
  }

  const handleSelectUnitForMovement = (unit: Unit) => {
    if (!movementState) return
    const classBudget = movementState.budget[unit.role]
    if (classBudget <= 0 || unit.owner !== movementState.player || unit.status !== 'deployed') return
    const wrap = unit.role === 'mage'
    const moves = computeLegalMoves(unit, boardMap, wrap)
    setMovementState({ ...movementState, selectedUnitId: unit.id, destinations: moves })
    const audioKey = baseMoveAudio[unit.base]
    playAudio(audioKey)
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
          return { ...unit, position: cell, status: 'deployed' }
        }
        return unit
      }),
    )
    const nextBudget: MovementBudget = { ...movementState.budget, [movingUnit.role]: movementState.budget[movingUnit.role] - 1 }
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

  const handleDiceSlotClick = (slotId: 'R1' | 'R2' | 'R3') => {
    if (step !== 6 || dicePlacementStage >= 3) return
    const targetSlot = diceSlots.find((slot) => slot.id === slotId)
    if (!targetSlot || targetSlot.die) return
    const nextDie = dicePlacementOrder[dicePlacementStage]
    setDiceSlots((prev) =>
      prev.map((slot) => (slot.id === slotId && !slot.die ? { ...slot, die: nextDie } : slot)),
    )
    playAudio('dicePlace')
    setDicePlacementStage((prev) => ((prev + 1) as DicePlacementStage))
  }

  const resetGame = () => {
    setPlayers(createInitialPlayers())
    setUnits([])
    setUnitCounter(0)
    setStep(1)
    setLeadingPlayer('A')
    setDiceSlots(initialDiceSlots.map((slot) => ({ ...slot })))
    setDicePlacementStage(0)
    setNextActions({ A: null, B: null })
    setPendingCreations({ 2: 3, 3: 3, 4: 2, 5: 2 })
    setCreationRequest(null)
    setCreationSelection({})
    setDiceRedistribution(null)
    setRedistributionChoice('R1')
    setMovementState(null)
    setPlacementState(null)
    setDiceOverlay(null)
    setActionSelection(null)
    setNameStage('names')
    setNameLocks({ A: false, B: false })
    setVictor(null)
  }

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
    setPlacementState((prev) =>
      prev ? { ...prev, swapMode: false, swapSelection: [] } : prev,
    )
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

  const handleActionSelection = (player: PlayerId, value: 'standard' | 'strategy' | 'comeback') => {
    setActionSelection({ player, value })
    playAudio('radio')
  }

  const confirmActionSelection = () => {
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

  const activeMovementUnits = units.filter(
    (unit) =>
      unit.owner === movementState?.player &&
      unit.status === 'deployed' &&
      movementState.budget[unit.role] > 0,
  )

  const renderCellContent = (cell: BoardCell) => {
    const unit = boardMap.get(cell)
    if (!unit) return null
    return (
      <div className={`piece piece--${unit.owner}`}>
        <span>{baseDisplayNames[unit.base][0]}</span>
        <small>{classDisplayNames[unit.role][0]}</small>
      </div>
    )
  }

  const renderProcedureControls = () => {
    if (step === 1) {
      return <p>プレイヤー名と先行を決定してください。</p>
    }
    if (step >= 2 && step <= 5) {
      const remaining = pendingCreations[step as 2 | 3 | 4 | 5]
      return (
        <>
          <p>
            残り{remaining}回、{players[activeStepPlayer].name}がユニット作成→配置を行います。
          </p>
          {remaining > 0 ? (
            <button
              onClick={() => {
                setCreationRequest({ player: activeStepPlayer, step })
                setCreationSelection({})
              }}
            >
              次のユニット作成
            </button>
          ) : (
            <p>必要回数を達成しました。</p>
          )}
        </>
      )
    }
    if (step === 6) {
      return (
        <p>
          銀→銀→金の順でR1〜R3に配置します。残り:{3 - dicePlacementStage}個
        </p>
      )
    }
    if (step === 7 || step === 12) {
      const player = activeStepPlayer
      if (players[player].energy === 0) {
        return (
          <>
            <p>エネルギー0のため通常アクションになります。</p>
            {nextActions[player] !== 'standard' ? (
              <button onClick={() => setNextActions((prev) => ({ ...prev, [player]: 'standard' }))}>
                通常アクションで進む
              </button>
            ) : null}
          </>
        )
      }
      return (
        <>
          <p>次アクションをラジオボタンで決定してください。</p>
          <button onClick={() => handleActionSelection(player, nextActions[player] ?? 'standard')}>
            選択モーダルを開く
          </button>
        </>
      )
    }
    if ([8, 9, 10, 13, 14, 15].includes(step)) {
      const actionMap: Record<number, { label: string; type: 'standard' | 'strategy' | 'comeback' }> = {
        8: { label: '通常アクション', type: 'standard' },
        9: { label: '作戦アクション', type: 'strategy' },
        10: { label: '起死回生アクション', type: 'comeback' },
        13: { label: '通常アクション', type: 'standard' },
        14: { label: '作戦アクション', type: 'strategy' },
        15: { label: '起死回生アクション', type: 'comeback' },
      }
      const info = actionMap[step]
      const player = activeStepPlayer
      if (nextActions[player] !== info.type) {
        return <p>指定されたアクションが選択されていません。前の手順で選択をやり直してください。</p>
      }
      return (
        <>
          <p>{info.label}を実行します。</p>
          <button onClick={() => executeAction(step)}>ダイスを使用して開始</button>
        </>
      )
    }
    if (step === 11 || step === 16) {
      return <p>勝利条件を確認し、必要であれば決着手順を実行してください。</p>
    }
    return null
  }

  return (
    <div className="app-shell">
      <header>
        <h1>Phantom Beast Fighting</h1>
        <p>オンライン専用二人用ボードゲーム</p>
      </header>
      <main className="board-layout">
        <section className="board-area">
          <div className="board-grid">
            {rows.map((row) => (
              <div key={row} className="board-row">
                {columns.map((column) => {
                  const cell = `${column}${row}` as BoardCell
                  const occupant = boardMap.get(cell)
                  const highlight =
                    (movementState?.selectedUnitId && movementState.destinations.includes(cell)) || false
                  const swapSelectable =
                    Boolean(placementState?.swapMode) &&
                    occupant &&
                    occupant.owner === placementState?.player
                  const swapSelected =
                    swapSelectable && placementState?.swapSelection.includes(occupant?.id ?? '')
                  return (
                    <button
                      key={cell}
                      className={`board-cell ${highlight ? 'highlight' : ''} ${swapSelected ? 'swap-selected' : ''}`}
                      onClick={() => {
                        if (placementState?.swapMode) {
                          if (swapSelectable && occupant) {
                            handleSwapSelection(occupant.id)
                          }
                          return
                        }
                        if (movementState) {
                          if (movementState.selectedUnitId && movementState.destinations.includes(cell)) {
                            handleMoveUnit(cell)
                            return
                          }
                          if (
                            !movementState.selectedUnitId &&
                            occupant &&
                            occupant.owner === movementState.player &&
                            movementState.budget[occupant.role] > 0
                          ) {
                            handleSelectUnitForMovement(occupant)
                            return
                          }
                        }
                      }}
                    >
                      {renderCellContent(cell)}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          <div className="dice-tray">
            <h3>サイコロ群置き場</h3>
            <div className="dice-slots">
              {diceSlots.map((slot) => (
                <button
                  key={slot.id}
                  className={`dice-slot ${slot.die ?? 'empty'}`}
                  onClick={() => handleDiceSlotClick(slot.id)}
                >
                  <span>{slot.id}</span>
                  <strong>{slot.die ? (slot.die === 'silver' ? '銀' : '金') : '未配置'}</strong>
                </button>
              ))}
            </div>
          </div>
        </section>
        <aside className="sidebar">
          {(['A', 'B'] as PlayerId[]).map((playerId) => (
            <section key={playerId} className="player-panel">
              <header>
                <h2>
                  {players[playerId].name}{' '}
                  <small>{playerId === leadingPlayer ? '（先行）' : ''}</small>
                </h2>
              </header>
              <div className="energy-track">
                {[3, 2, 1].map((threshold, index) => (
                  <span
                    key={threshold}
                    className={`token ${players[playerId].energy >= threshold ? 'lit' : ''}`}
                    aria-label={`T${3 - index}`}
                  />
                ))}
                <p>エネルギー: {players[playerId].energy}</p>
              </div>
              <div className="class-counts">
                {(Object.keys(classDisplayNames) as ClassType[]).map((role) => (
                  <div key={role} className="count-row">
                    <span>{classDisplayNames[role]}</span>
                    <strong>{remainingByClass[playerId]?.[role] ?? 0}</strong>
                  </div>
                ))}
              </div>
              <div className="card-counts">
                <p>ユニット作成用カード</p>
                <ul>
                  {(Object.keys(baseDisplayNames) as BaseType[]).map((base) => (
                    <li key={base}>
                      {baseDisplayNames[base]}: {players[playerId].baseCards[base]}
                    </li>
                  ))}
                </ul>
                <ul>
                  {(Object.keys(classDisplayNames) as ClassType[]).map((role) => (
                    <li key={role}>
                      {classDisplayNames[role]}: {players[playerId].classCards[role]}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                disabled={![7, 12].includes(step) || actionSelection?.player === playerId}
                onClick={() => handleActionSelection(playerId, 'standard')}
              >
                次アクション選択
              </button>
            </section>
          ))}
          <section className="procedure-panel">
            <h2>現在の手順</h2>
            <p>
              手順{step}: {stepDescriptions[step]}
            </p>
            <p>対象プレイヤー: {players[activeStepPlayer].name}</p>
            <div className="procedure-actions">{renderProcedureControls()}</div>
            <button disabled={!canAdvanceStep()} onClick={goToNextStep}>
              手順完了
            </button>
          </section>
          {movementState ? (
            <section className="movement-panel">
              <h3>兵種別移動可能数</h3>
              <ul>
                <li>剣士: {movementState.budget.swordsman}</li>
                <li>魔術師: {movementState.budget.mage}</li>
                <li>策士: {movementState.budget.tactician}</li>
              </ul>
              <p>{players[movementState.player].name}の移動を完了してください。</p>
              <div className="unit-selection">
                {activeMovementUnits.map((unit) => (
                  <button key={unit.id} onClick={() => handleSelectUnitForMovement(unit)}>
                    {createUnitLabel(unit)}
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </main>

      <Modal title="プレイヤー設定" isOpen={step === 1 && !victor}>
        {nameStage === 'names' && (
          <div className="name-stage">
            {(['A', 'B'] as PlayerId[]).map((id) => (
              <div key={id} className="name-row">
                <label>
                  {id}の名前
                  <input
                    value={nameDrafts[id]}
                    disabled={nameLocks[id]}
                    onChange={(event) =>
                      setNameDrafts((prev) => ({ ...prev, [id]: event.target.value }))
                    }
                  />
                </label>
                <button onClick={() => setNameLocks((prev) => ({ ...prev, [id]: true }))}>
                  決定
                </button>
              </div>
            ))}
            {nameLocks.A && nameLocks.B ? (
              <button onClick={() => setNameStage('confirmNames')}>この名前で確認</button>
            ) : null}
          </div>
        )}
        {nameStage === 'confirmNames' && (
          <div>
            <p>
              A: {nameDrafts.A} / B: {nameDrafts.B} でよいですか？
            </p>
            <div className="modal-actions">
              <button onClick={() => setNameStage('initiative')}>確認</button>
              <button onClick={() => setNameStage('names')}>戻る</button>
            </div>
          </div>
        )}
        {nameStage === 'initiative' && (
          <div>
            <p>先行プレイヤーを選択してください。</p>
            {(['A', 'B'] as PlayerId[]).map((id) => (
              <label key={id} className="radio-row">
                <input
                  type="radio"
                  checked={initiativeChoice === id}
                  onChange={() => setInitiativeChoice(id)}
                />
                {nameDrafts[id]}
              </label>
            ))}
            <button onClick={() => setNameStage('confirmInitiative')}>先行決定</button>
          </div>
        )}
        {nameStage === 'confirmInitiative' && (
          <div>
            <p>{nameDrafts[initiativeChoice]}を先行にします。よろしいですか？</p>
            <div className="modal-actions">
              <button
                onClick={() => {
                  setPlayers((prev) => ({
                    A: { ...prev.A, name: nameDrafts.A },
                    B: { ...prev.B, name: nameDrafts.B },
                  }))
                  setLeadingPlayer(initiativeChoice)
                  setStep(2)
                }}
              >
                確認
              </button>
              <button onClick={() => setNameStage('initiative')}>戻る</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="次アクション選択"
        isOpen={Boolean(actionSelection)}
        onClose={() => setActionSelection(null)}
        footer={
          <div className="modal-actions">
            <button onClick={confirmActionSelection}>決定</button>
            <button className="ghost" onClick={() => setActionSelection(null)}>
              キャンセル
            </button>
          </div>
        }
      >
        {actionSelection ? (
          <div>
            <p>{players[actionSelection.player].name}の行動を選択してください。</p>
            {(['standard', 'strategy', 'comeback'] as const).map((value) => (
              <label key={value} className="radio-row">
                <input
                  type="radio"
                  checked={actionSelection.value === value}
                  onChange={() => handleActionSelection(actionSelection.player, value)}
                  disabled={
                    (value === 'comeback' && players[actionSelection.player].energy < 3) ||
                    (value === 'strategy' && players[actionSelection.player].energy === 0)
                  }
                />
                {value === 'standard'
                  ? '通常アクション（エネルギー消費0）'
                  : value === 'strategy'
                    ? '作戦アクション（エネルギー1）'
                    : '起死回生アクション（エネルギー3）'}
              </label>
            ))}
          </div>
        ) : null}
      </Modal>

      <Modal title="ユニット配置" isOpen={Boolean(placementState)} onClose={() => setPlacementState(null)}>
        {placementState ? (
          <div>
            <p>{players[placementState.player].name}の配置前ユニットを選択</p>
            <div className="unit-selection">
              {activePlacementUnits.length === 0 ? (
                <>
                  <p>配置前のユニットはありません。</p>
                  {placementState.swapMode ? (
                    <>
                      <p>入れ替えたい配置済みユニットを2体選択してください。</p>
                      <button onClick={() => setMiniBoardState({ mode: 'swap', player: placementState.player })}>
                        ミニ配置面を開く
                      </button>
                      <button
                        className="ghost"
                        onClick={() => setPlacementState({ ...placementState, swapMode: false, swapSelection: [] })}
                      >
                        入れ替えを中止
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setPlacementState({ ...placementState, swapMode: true, swapSelection: [] })
                        setMiniBoardState({ mode: 'swap', player: placementState.player })
                      }}
                    >
                      配置済みユニットを入れ替える
                    </button>
                  )}
                </>
              ) : (
                activePlacementUnits.map((unit) => (
                  <button key={unit.id} onClick={() => placementSelectionHandler(unit.id)}>
                    {createUnitLabel(unit)}
                  </button>
                ))
              )}
            </div>
            <p>ユニットを選ぶとミニ配置面が表示され、そこから配置場所を決定できます。</p>
          </div>
        ) : null}
      </Modal>

      <Modal
        title={miniBoardState?.mode === 'swap' ? 'ユニット入れ替え' : '配置マス選択'}
        isOpen={Boolean(miniBoardState)}
        onClose={cancelMiniBoard}
        footer={
          <div className="modal-actions">
            <button className="ghost" onClick={cancelMiniBoard}>
              キャンセル
            </button>
          </div>
        }
      >
        {miniBoardState && placementState ? (
          <div>
            <p>
              {miniBoardState.mode === 'swap'
                ? '入れ替える自分のユニットを2体選択してください。'
                : 'ミニ配置面から配置場所を選択してください。'}
            </p>
            <div className="mini-board">
              {rows.map((row) => (
                <div key={row} className="mini-row">
                  {columns.map((column) => {
                    const cell = `${column}${row}` as BoardCell
                    const occupant = boardMap.get(cell)
                    const selectable =
                      miniBoardState.mode === 'placement'
                        ? currentPlacementTargets.includes(cell)
                        : Boolean(occupant && occupant.owner === miniBoardState.player)
                    const swapChosen =
                      miniBoardState.mode === 'swap' && occupant
                        ? placementState.swapSelection.includes(occupant.id)
                        : false
                    return (
                      <button
                        key={cell}
                        className={`mini-cell ${selectable ? 'highlight' : ''} ${swapChosen ? 'swap-selected' : ''}`}
                        disabled={!selectable}
                        onClick={() => handleMiniBoardClick(cell)}
                      >
                        {occupant ? (
                          <span className={`mini-piece mini-piece--${occupant.owner}`}>
                            {baseDisplayNames[occupant.base][0]}
                            <small>{classDisplayNames[occupant.role][0]}</small>
                          </span>
                        ) : (
                          <span className="mini-cell__label">{column + row}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        title="ユニット作成"
        isOpen={Boolean(creationRequest)}
        onClose={() => setCreationRequest(null)}
        footer={
          creationRequest ? (
            <div className="modal-actions">
              <button
                disabled={!creationSelection.base || !creationSelection.role}
                onClick={() => {
                  if (creationRequest && creationSelection.base && creationSelection.role) {
                    handleCreateUnit(
                      creationRequest.player,
                      creationSelection.base,
                      creationSelection.role,
                      creationRequest.step,
                    )
                    setCreationRequest(null)
                    setCreationSelection({})
                  }
                }}
              >
                作成する
              </button>
              <button className="ghost" onClick={() => setCreationRequest(null)}>
                キャンセル
              </button>
            </div>
          ) : null
        }
      >
        {creationRequest ? (
          <div>
            <p>{players[creationRequest.player].name}のベースと兵種を選択してください。</p>
            <div className="card-picker">
              {(Object.keys(baseDisplayNames) as BaseType[]).map((base) => (
                <button
                  key={base}
                  disabled={players[creationRequest.player].baseCards[base] <= 0}
                  className={creationSelection.base === base ? 'selected' : ''}
                  onClick={() => setCreationSelection((prev) => ({ ...prev, base }))}
                >
                  {baseDisplayNames[base]} ({players[creationRequest.player].baseCards[base]})
                </button>
              ))}
            </div>
            <div className="card-picker">
              {(Object.keys(classDisplayNames) as ClassType[]).map((role) => (
                <button
                  key={role}
                  disabled={players[creationRequest.player].classCards[role] <= 0}
                  className={creationSelection.role === role ? 'selected' : ''}
                  onClick={() => setCreationSelection((prev) => ({ ...prev, role }))}
                >
                  {classDisplayNames[role]} ({players[creationRequest.player].classCards[role]})
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        title="サイコロ再配置"
        isOpen={Boolean(diceRedistribution)}
        onClose={() => setDiceRedistribution(null)}
        footer={
          diceRedistribution ? (
            <div className="modal-actions">
              <button onClick={completeRedistribution}>決定</button>
              <button className="ghost" onClick={() => setDiceRedistribution(null)}>
                キャンセル
              </button>
            </div>
          ) : null
        }
      >
        {diceRedistribution ? (
          <div>
            <p>
              {diceRedistribution.type === 'strategy'
                ? '金サイコロを配置するスロットを選択してください。R1には銀を配置します。'
                : '金サイコロを配置するスロットを１つ選びます。'}
            </p>
            {diceRedistribution.options.map((slot) => (
              <label key={slot} className="radio-row">
                <input
                  type="radio"
                  checked={redistributionChoice === slot}
                  onChange={() => setRedistributionChoice(slot)}
                />
                {slot}
              </label>
            ))}
          </div>
        ) : null}
      </Modal>

      {diceOverlay ? (
        <DiceRollerOverlay dice={diceOverlay.dice} tallies={diceOverlay.tallies} visible onClose={confirmDiceResult} settings={diceOverlay.debugSettings} />
      ) : null}

      {victor ? (
        <div className="victory-overlay">
          <div className="victory-banner">{players[victor].name}の勝利</div>
          <button onClick={resetGame}>再度ゲームを開始</button>
        </div>
      ) : null}
    </div>
  )
}

export default App
