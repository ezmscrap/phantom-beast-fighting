import type {
  AudioCue,
  BaseType,
  BoardCell,
  ClassType,
  ColumnLabel,
  DiceType,
  MovementBudget,
  PlayerId,
  ProcedureStep,
  RowLabel,
} from './types'
import { resolveAssetPath } from './utils/assetPath'

export const columns: ColumnLabel[] = ['A', 'B', 'C', 'D', 'E']
export const rows: RowLabel[] = [1, 2, 3, 4, 5, 6]

export const boardCells: BoardCell[] = columns.flatMap((column) =>
  rows.map((row) => `${column}${row}` as BoardCell),
)

export const playerColors: Record<PlayerId, 'white' | 'black'> = {
  A: 'white',
  B: 'black',
}

export const baseDisplayNames: Record<BaseType, string> = {
  dragon: 'ドラゴン',
  griffin: 'グリフォン',
  unicorn: 'ユニコーン',
}

export const classDisplayNames: Record<ClassType, string> = {
  swordsman: '剣士',
  mage: '魔術師',
  tactician: '策士',
}

export const INITIAL_BASE_CARDS = {
  dragon: 1,
  griffin: 2,
  unicorn: 2,
} satisfies Record<BaseType, number>

export const INITIAL_CLASS_CARDS = {
  tactician: 1,
  mage: 2,
  swordsman: 2,
} satisfies Record<ClassType, number>

export const placementRows: Record<PlayerId, RowLabel> = {
  A: 2,
  B: 5,
}

export const actionCosts = {
  standard: 0,
  strategy: 1,
  comeback: 3,
} as const

export const diceFaceLabels: Record<ClassType, string> = {
  swordsman: '剣士',
  mage: '魔術師',
  tactician: '策士',
}

export const diceFaceColors: Record<DiceType, string> = {
  silver: '#e4f1ff',
  gold: '#d2a100',
}

export const SILVER_FACES: ClassType[] = [
  'swordsman',
  'swordsman',
  'swordsman',
  'mage',
  'mage',
  'tactician',
]

export const GOLD_FACES: ClassType[] = [
  'swordsman',
  'mage',
  'mage',
  'mage',
  'tactician',
  'tactician',
]

export const stepDescriptions: Record<ProcedureStep, string> = {
  0: '対戦形式決定手順',
  1: '先行決定手順',
  2: '先行前期作戦手順（先行が3回ユニット作成→配置）',
  3: '後攻作戦手順（後攻が5回ユニット作成→配置）',
  4: '先行後期作戦手順（先行が2回ユニット作成→配置）',
  5: '欠番（処理なし）',
  6: '先行サイコロ配置手順（R1,R2,R3へ銀銀金を配置）',
  7: '先行エネルギー消費決定手順',
  8: '先行通常アクション手順',
  9: '先行作戦アクション手順',
  10: '先行起死回生アクション手順',
  11: '先行勝利判定手順',
  12: '後攻エネルギー消費決定手順',
  13: '後攻通常アクション手順',
  14: '後攻作戦アクション手順',
  15: '後攻起死回生アクション手順',
  16: '後攻勝利判定手順',
}

const rowOffsets = [-3, -2, -1, 0, 1, 2, 3]

const parsePattern = (pattern: string[]): [number, number][] => {
  const offsets: [number, number][] = []
  pattern.forEach((line, rowIndex) => {
    const dy = rowOffsets[rowIndex]
    Array.from(line).forEach((value, colIndex) => {
      if (value === '1') {
        const dx = colIndex - 3
        offsets.push([dy, dx])
      }
    })
  })
  return offsets
}

const DRAGON_PATTERN = [
  '0000000',
  '0101010',
  '0011100',
  '0110110',
  '0011100',
  '0101010',
  '0000000',
]

const GRIFFIN_PATTERN = [
  '0000000',
  '0000000',
  '0011100',
  '0010100',
  '0011100',
  '0000000',
  '0000000',
]

const UNICORN_PATTERN = [
  '0000000',
  '0010100',
  '0100010',
  '0000000',
  '0100010',
  '0010100',
  '0000000',
]

export const dragonOffsets = parsePattern(DRAGON_PATTERN)
export const griffinOffsets = parsePattern(GRIFFIN_PATTERN)
export const unicornOffsets = parsePattern(UNICORN_PATTERN)

export const audioMap: Record<AudioCue, string> = {
  button: resolveAssetPath('audio/button_click.mp3'),
  radio: resolveAssetPath('audio/radio_select.mp3'),
  unitPlace: resolveAssetPath('audio/card_place.mp3'),
  dicePlace: resolveAssetPath('audio/card_place.mp3'),
  cancel: resolveAssetPath('audio/cancel.mp3'),
  diceSingle: resolveAssetPath('audio/dice_single.mp3'),
  diceMulti: resolveAssetPath('audio/dice_multi.mp3'),
  dragonMove: resolveAssetPath('audio/dragon_move.mp3'),
  griffinMove: resolveAssetPath('audio/griffin_move.mp3'),
  unicornMove: resolveAssetPath('audio/unicorn_move.mp3'),
  swordAttack: resolveAssetPath('audio/sword_attack.mp3'),
  mageAttack: resolveAssetPath('audio/mage_attack.mp3'),
  tacticianAttack: resolveAssetPath('audio/tactician_attack.mp3'),
}

export const baseMoveAudio: Record<BaseType, AudioCue> = {
  dragon: 'dragonMove',
  griffin: 'griffinMove',
  unicorn: 'unicornMove',
}

export const classAttackAudio: Record<ClassType, AudioCue> = {
  swordsman: 'swordAttack',
  mage: 'mageAttack',
  tactician: 'tacticianAttack',
}

export const dicePlacementOrder: DiceType[] = ['silver', 'silver', 'gold']

export const emptyBudget: MovementBudget = {
  swordsman: 0,
  mage: 0,
  tactician: 0,
}
