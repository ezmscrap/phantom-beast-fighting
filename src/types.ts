export type PlayerId = 'A' | 'B'

export type BaseType = 'dragon' | 'griffin' | 'unicorn'
export type ClassType = 'swordsman' | 'mage' | 'tactician'

export type UnitStatus = 'preDeployment' | 'deployed' | 'removed'

export type ColumnLabel = 'A' | 'B' | 'C' | 'D' | 'E'
export type RowLabel = 1 | 2 | 3 | 4 | 5 | 6
export type BoardCell = `${ColumnLabel}${RowLabel}`

export interface Unit {
  id: string
  owner: PlayerId
  base: BaseType
  role: ClassType
  status: UnitStatus
  position?: BoardCell
}

export interface PlayerState {
  id: PlayerId
  name: string
  color: 'white' | 'black'
  energy: number
  baseCards: Record<BaseType, number>
  classCards: Record<ClassType, number>
}

export type DiceType = 'silver' | 'gold'

export type DicePlacementStage = 0 | 1 | 2 | 3

export interface DiceSlotState {
  id: 'R1' | 'R2' | 'R3'
  die: DiceType | null
}

export type ActionType = 'standard' | 'strategy' | 'comeback'

export interface DiceSlot {
  id: 'R1' | 'R2' | 'R3'
  type: DiceType
}

export interface DiceRedistributionState {
  type: 'strategy' | 'comeback'
  options: Array<'R1' | 'R2' | 'R3'>
  player: PlayerId
}

export type ProcedureStep =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16

export interface MovementBudget {
  swordsman: number
  mage: number
  tactician: number
}

export interface PlacementState {
  player: PlayerId
  selectedUnitId?: string
  swapMode: boolean
  swapSelection: string[]
  stepTag?: ProcedureStep
}

export interface MovementState {
  player: PlayerId
  budget: MovementBudget
  action: ActionType
  diceUsed: DiceType[]
  selectedUnitId?: string
  destinations: BoardCell[]
  locked: boolean
}

export interface ActionSelectionState {
  player: PlayerId
  value: ActionType
}

export interface MiniBoardState {
  mode: 'placement' | 'swap'
  player: PlayerId
}

export type NextActions = Record<PlayerId, ActionType | null>

export type PendingCreations = Record<2 | 3 | 4 | 5, number>

export interface DiceRollResult {
  faces: ClassType[]
  tallies: MovementBudget
}

export interface MovementContext {
  activePlayer: PlayerId
  action: 'standard' | 'strategy' | 'comeback'
  diceUsed: DiceType[]
  budget: MovementBudget
  locked: boolean
}

export type AudioCue =
  | 'button'
  | 'radio'
  | 'unitPlace'
  | 'dicePlace'
  | 'cancel'
  | 'diceSingle'
  | 'diceMulti'
  | 'dragonMove'
  | 'griffinMove'
  | 'unicornMove'
  | 'swordAttack'
  | 'mageAttack'
  | 'tacticianAttack'

export interface DebugDiceSettings {
  dieSize: number
  spawnHeight: number
  impulse: {
    x: number
    y: number
    z: number
    torque: number
    minHorizontal: number
  }
}
