import { useCallback, useEffect, useRef } from 'react'
import type { DebugDiceSettings, DiceType } from '../../types'
import type { RollResultEntry, DiceRollPlan } from '../../lib/diceEngine'
import { DiceEngine, buildNotation } from '../../lib/diceEngine'

interface RollSource {
  id: string
  type: DiceType
}

interface DiceRollStageProps {
  dice: RollSource[]
  rollSessionId: string
  visible: boolean
  debugSettings?: DebugDiceSettings
  onRollResult: (results: RollResultEntry[]) => void
}

const createOutcomeValues = (count: number) =>
  Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1)

export const DiceRollStage = ({ dice, rollSessionId, visible, debugSettings, onRollResult }: DiceRollStageProps) => {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const engineRef = useRef<DiceEngine | null>(null)

  useEffect(() => {
    return () => {
      engineRef.current?.dispose()
      engineRef.current = null
    }
  }, [])

  const ensureEngine = useCallback(() => {
    if (!stageRef.current) return null
    if (!engineRef.current) {
      engineRef.current = new DiceEngine(stageRef.current, debugSettings)
    } else if (debugSettings) {
      engineRef.current.setSettings(debugSettings)
    }
    return engineRef.current
  }, [debugSettings])

  useEffect(() => {
    if (!visible) {
      engineRef.current?.cancelRoll()
      return
    }
    if (!dice.length) {
      onRollResult([])
      return
    }
    const values = createOutcomeValues(dice.length)
    let cancelled = false
    const launchRoll = async () => {
      const engine = ensureEngine()
      if (!engine) return
      const plan: DiceRollPlan[] = dice.map((die, index) => ({
        id: die.id,
        type: die.type,
        targetValue: values[index],
      }))
      const notation = buildNotation(plan)
      try {
        const result = await engine.roll(plan, { notation, debugSettings })
        if (!cancelled) {
          onRollResult(result.dice)
        }
      } catch (error) {
        if (!cancelled && (error as Error | undefined)?.message !== 'Roll cancelled') {
          console.error('Dice roll failed', error)
        }
      }
    }

    launchRoll()

    return () => {
      cancelled = true
      engineRef.current?.cancelRoll()
    }
  }, [dice, visible, rollSessionId, ensureEngine, debugSettings, onRollResult])

  return (
    <div className="dice-overlay" aria-hidden="true">
      <div className="dice-stage">
        <div ref={stageRef} className="dice-stage__canvas-container" />
      </div>
    </div>
  )
}
