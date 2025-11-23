import { useCallback, useRef, useState, useEffect } from 'react'
import { appConfig, resolvePresetDice } from '../config'
import type { DebugDiceSettings, DiceType, MovementBudget } from '../types'
import type { DiceVisual } from '../components/DiceRollerOverlay'

interface DiceOverlayState {
  dice: DiceVisual[]
  tallies: MovementBudget
  debugSettings?: DebugDiceSettings
}

const createEmptyBudget = (): MovementBudget => ({ swordsman: 0, mage: 0, tactician: 0 })

const createVisuals = (diceTypes: DiceType[]) =>
  diceTypes.map((type, index) => ({
    id: `dice-${Date.now()}-${index}`,
    type,
  }))

export const useDiceRoller = () => {
  const [overlay, setOverlay] = useState<DiceOverlayState | null>(null)
  const [debugSettings, setDebugSettings] = useState<DebugDiceSettings>({
    dieSize: appConfig.diceDebug.dieSize,
    spawnHeight: appConfig.diceDebug.spawnHeight,
    impulse: { ...appConfig.diceDebug.impulse },
  })

  const debugSettingsRef = useRef(debugSettings)

  useEffect(() => {
    debugSettingsRef.current = debugSettings
  }, [debugSettings])

  const launchRoll = useCallback(
    (diceTypes: DiceType[]) => {
      const visuals = createVisuals(diceTypes)
      const budget = createEmptyBudget()
      setOverlay({ dice: visuals, tallies: { ...budget } })
      return { budget }
    },
    [],
  )

  const handleResolve = useCallback((updatedDice: DiceVisual[], tallies: MovementBudget) => {
    setOverlay((prev) => (prev ? { ...prev, dice: updatedDice, tallies } : prev))
  }, [])

  const closeOverlay = useCallback(() => setOverlay(null), [])

  const relaunchWithDebugSettings = useCallback(() => {
    setOverlay((prev) => {
      const settings = debugSettingsRef.current
      if (prev) {
        return { ...prev, debugSettings: settings }
      }
      const diceTypes = resolvePresetDice(appConfig.diceDebug.preset)
      return { dice: createVisuals(diceTypes), tallies: createEmptyBudget(), debugSettings: settings }
    })
  }, [])

  return {
    overlay,
    debugSettings,
    setDebugSettings,
    launchRoll,
    closeOverlay,
    handleResolve,
    relaunchWithDebugSettings,
  }
}
