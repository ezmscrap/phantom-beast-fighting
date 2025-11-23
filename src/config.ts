import type { DiceType } from './types'

type DebugDiceOption = 'silver1' | 'gold1' | 'silver2' | 'mixedSG' | 'mixedSSG'

interface DiceDebugConfig {
  enabled: boolean
  preset: DebugDiceOption
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

export interface AppConfig {
  diceDebug: DiceDebugConfig
}

export const appConfig: AppConfig = {
  diceDebug: {
    enabled: true,
    preset: 'mixedSSG',
    dieSize: 0.75,
    spawnHeight: 5,
    impulse: {
      x: 6,
      y: 5,
      z: 6,
      torque: 6,
      minHorizontal: 1.5,
    },
  },
}

export const resolvePresetDice = (preset: DebugDiceOption): DiceType[] => {
  switch (preset) {
    case 'silver1':
      return ['silver']
    case 'gold1':
      return ['gold']
    case 'silver2':
      return ['silver', 'silver']
    case 'mixedSG':
      return ['silver', 'gold']
    case 'mixedSSG':
      return ['silver', 'silver', 'gold']
    default:
      return ['silver']
  }
}
