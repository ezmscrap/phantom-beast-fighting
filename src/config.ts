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
    enabled: false,
    preset: 'silver1',
    dieSize: 0.75,
    spawnHeight: 15,
    impulse: {
      x: 90000,
      y: 900,
      z: 9,
      torque: 160,
      minHorizontal: 2400,
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
