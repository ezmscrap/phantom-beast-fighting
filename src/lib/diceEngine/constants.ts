import type { DiceType } from '../../types'
import type { BeastLabel } from '../../diceFaces'
import { GOLD_D6_LABELS, SILVER_D6_LABELS } from '../../diceFaces'
import { Vec3 } from 'cannon-es'

export const FACE_NORMALS: Record<number, Vec3> = {
  1: new Vec3(0, 1, 0),
  2: new Vec3(1, 0, 0),
  3: new Vec3(0, 0, 1),
  4: new Vec3(0, 0, -1),
  5: new Vec3(-1, 0, 0),
  6: new Vec3(0, -1, 0),
}

export const FACE_VALUE_ORDER = [2, 5, 1, 6, 3, 4]

export const LABEL_SETS: Record<DiceType, readonly BeastLabel[]> = {
  silver: SILVER_D6_LABELS,
  gold: GOLD_D6_LABELS,
}

export const FACE_BG_COLOR: Record<DiceType, string> = {
  silver: '#f1f7ff',
  gold: '#fbe7b5',
}
export const FACE_TEXT_COLOR: Record<DiceType, string> = {
  silver: '#142035',
  gold: '#462200',
}
export const FACE_BORDER_COLOR = '#101010'

export const STAGE_HALF_WIDTH = 4.8
export const STAGE_HALF_DEPTH = 4.8
export const STAGE_WALL_HEIGHT = 7
export const STAGE_WALL_THICKNESS = 0.35
export const STAGE_CEILING_HEIGHT = 11
export const STAGE_MARGIN = 0.6
