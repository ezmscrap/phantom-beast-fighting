import type { ClassType, DiceType } from '../../types'
import type { BeastLabel } from '../../diceFaces'

export interface DiceVisual {
  id: string
  type: DiceType
  faceIndex?: number
  result?: ClassType
  label?: BeastLabel
}
