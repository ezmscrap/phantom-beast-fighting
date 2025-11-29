import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GOLD_FACES, SILVER_FACES } from '../constants'
import type { ClassType, DiceType, MovementBudget, DebugDiceSettings } from '../types'
import type { BeastLabel } from '../diceFaces'
import { DiceEngine, buildNotation, type DiceRollPlan, type RollResultEntry } from '../lib/diceEngine'

export interface DiceVisual {
  id: string
  type: DiceType
  faceIndex?: number
  result?: ClassType
  label?: BeastLabel
}

interface DiceRollerOverlayProps {
  dice: DiceVisual[]
  tallies: MovementBudget
  visible: boolean
  onClose: () => void
  rollSessionId: string
  onResolve: (dice: DiceVisual[], tallies: MovementBudget) => void
  debugSettings?: DebugDiceSettings
}

const FACE_DEFINITIONS: Record<DiceType, ClassType[]> = {
  silver: SILVER_FACES,
  gold: GOLD_FACES,
}

const DICE_LABEL: Record<DiceType, string> = {
  silver: '銀',
  gold: '金',
}

const createEmptyTallies = (): MovementBudget => ({ swordsman: 0, mage: 0, tactician: 0 })

const applyTallies = (dice: DiceVisual[]): MovementBudget =>
  dice.reduce((acc, die) => {
    if (die.result) {
      acc[die.result] += 1
    }
    return acc
  }, createEmptyTallies())

const createOutcomeValues = (count: number) =>
  Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1)

export const DiceRollerOverlay = ({
  dice,
  visible,
  onClose,
  tallies,
  rollSessionId,
  onResolve,
  debugSettings,
}: DiceRollerOverlayProps) => {
  const numericMode = debugSettings?.numericMode ?? false
  const [settled, setSettled] = useState(false)
  const [resultsDispatched, setResultsDispatched] = useState(false)
  const sessionStartRef = useRef<number>(Date.now())
  const engineRef = useRef<DiceEngine | null>(null)
  const diceSnapshotRef = useRef<DiceVisual[]>(dice.map((die) => ({ ...die })))
  const containerId = useMemo(() => `dice-box-stage-${Math.random().toString(36).slice(2, 9)}`, [])
  const stageRef = useRef<HTMLDivElement | null>(null)
  const previousSessionIdRef = useRef<string>(rollSessionId)
  const resultsDispatchedRef = useRef(false)

  if (previousSessionIdRef.current !== rollSessionId) {
    previousSessionIdRef.current = rollSessionId
    diceSnapshotRef.current = dice.map((die) => ({ ...die }))
  }

  const finalizeResults = useCallback(
    (results: RollResultEntry[]) => {
      if (resultsDispatchedRef.current) return
      const sourceDice = diceSnapshotRef.current
      const resultMap = new Map(results.map((entry) => [entry.id, entry]))
      const updatedDice = sourceDice.map((die) => {
        const entry = resultMap.get(die.id)
        if (!entry) return die
        const faces = FACE_DEFINITIONS[die.type]
        const faceIndex = Math.min(Math.max(entry.value - 1, 0), faces.length - 1)
        return {
          ...die,
          faceIndex,
          result: faces[faceIndex],
          label: entry.label,
        }
      })
      const computedTallies = applyTallies(updatedDice)
      resultsDispatchedRef.current = true
      setSettled(true)
      setResultsDispatched(true)
      onResolve(updatedDice, computedTallies)
    },
    [onResolve],
  )

  useEffect(() => {
    setSettled(false)
    setResultsDispatched(false)
    sessionStartRef.current = Date.now()
    resultsDispatchedRef.current = false
  }, [rollSessionId])

  useEffect(() => {
    resultsDispatchedRef.current = resultsDispatched
  }, [resultsDispatched])

  useEffect(
    () => () => {
      engineRef.current?.dispose()
      engineRef.current = null
    },
    [],
  )

  const ensureEngine = useCallback(() => {
    if (!stageRef.current) return null
    if (!engineRef.current) {
      engineRef.current = new DiceEngine(stageRef.current, debugSettings)
    }
    return engineRef.current
  }, [debugSettings])

  useEffect(() => {
    if (!visible) {
      engineRef.current?.cancelRoll()
      return
    }
    const sourceDice = diceSnapshotRef.current
    if (!sourceDice.length) {
      finalizeResults([])
      return
    }
    const values = createOutcomeValues(sourceDice.length)
    let cancelled = false

    const startRoll = async () => {
      const engine = ensureEngine()
      if (!engine) return
      const plan: DiceRollPlan[] = sourceDice.map((die, index) => ({
        id: die.id,
        type: die.type,
        targetValue: values[index],
      }))
      const notation = buildNotation(plan)
      try {
        const result = await engine.roll(plan, { notation, debugSettings })
        if (!cancelled) {
          finalizeResults(result.dice)
        }
      } catch (error) {
        if (!cancelled && (error as Error | undefined)?.message !== 'Roll cancelled') {
          console.error('Dice roll failed', error)
        }
      }
    }

    startRoll()

    return () => {
      cancelled = true
      engineRef.current?.cancelRoll()
    }
  }, [visible, rollSessionId, ensureEngine, finalizeResults, debugSettings])

  useEffect(() => {
    if (!settled) return
    const elapsed = Date.now() - sessionStartRef.current
    const remaining = Math.max(0, 10000 - elapsed)
    const timer = setTimeout(() => {
      onClose()
    }, remaining)
    return () => clearTimeout(timer)
  }, [settled, onClose])

  if (!visible) {
    return null
  }

  return (
    <>
      <div className="dice-overlay" aria-hidden="true">
        <div className="dice-stage">
          <div id={containerId} ref={stageRef} className="dice-stage__canvas-container" />
        </div>
      </div>
      <div className="dice-overlay__summary">
        {numericMode ? (
          <div className="dice-results-list">
            {dice.map((die) => (
              <p key={die.id}>
                {DICE_LABEL[die.type]}: {die.faceIndex != null ? die.faceIndex + 1 : '---'}
              </p>
            ))}
          </div>
        ) : (
          <p>剣士: {tallies.swordsman} / 魔術師: {tallies.mage} / 策士: {tallies.tactician}</p>
        )}
        {settled ? (
          <button className="primary" onClick={onClose}>
            結果を適用する
          </button>
        ) : (
          <p>ロール中...</p>
        )}
      </div>
    </>
  )
}
