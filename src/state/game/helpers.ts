import { INITIAL_BASE_CARDS, INITIAL_CLASS_CARDS, baseDisplayNames, classDisplayNames } from '../../constants'
import type { PlayerId, PlayerState, Unit } from '../../types'

export const createInitialPlayers = (): Record<PlayerId, PlayerState> => ({
  A: {
    id: 'A',
    name: 'プレイヤーA',
    color: 'white',
    energy: 0,
    baseCards: { ...INITIAL_BASE_CARDS },
    classCards: { ...INITIAL_CLASS_CARDS },
  },
  B: {
    id: 'B',
    name: 'プレイヤーB',
    color: 'black',
    energy: 0,
    baseCards: { ...INITIAL_BASE_CARDS },
    classCards: { ...INITIAL_CLASS_CARDS },
  },
})

export const opponentOf = (player: PlayerId): PlayerId => (player === 'A' ? 'B' : 'A')

export const createUnitLabel = (unit: Unit) => `${baseDisplayNames[unit.base]}${classDisplayNames[unit.role]}`
