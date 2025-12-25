import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GOLD_FACES, SILVER_FACES } from '../constants'
import type { ClassType, DiceType, MovementBudget, DebugDiceSettings } from '../types'
import type { RollResultEntry } from '../lib/diceEngine'
import { DiceRollStage } from './dice/DiceRollStage'
import { DiceResultsSummary } from './dice/DiceResultsSummary'
import type { DiceVisual } from './dice/types'

interface DiceRollerOverlayProps {
  dice: DiceVisual[]
  tallies: MovementBudget
  visible: boolean
  onClose: () => void
  rollSessionId: string
  onResolve: (dice: DiceVisual[], tallies: MovementBudget) => void
  debugSettings?: DebugDiceSettings
  predeterminedValues?: number[]
}

const FACE_DEFINITIONS: Record<DiceType, ClassType[]> = {
  silver: SILVER_FACES,
  gold: GOLD_FACES,
}

const createEmptyTallies = (): MovementBudget => ({ swordsman: 0, mage: 0, tactician: 0 })

const applyTallies = (dice: DiceVisual[]): MovementBudget =>
  dice.reduce((acc, die) => {
    if (die.result) {
      acc[die.result] += 1
    }
    return acc
  }, createEmptyTallies())

export const DiceRollerOverlay = ({
  dice,
  visible,
  onClose,
  tallies,
  rollSessionId,
  onResolve,
  debugSettings,
  predeterminedValues,
}: DiceRollerOverlayProps) => {
  const numericMode = debugSettings?.numericMode ?? false
  const [settled, setSettled] = useState(false)
  const [resultsDispatched, setResultsDispatched] = useState(false)
  const sessionStartRef = useRef<number>(Date.now())
  const diceSnapshotRef = useRef<DiceVisual[]>(dice.map((die) => ({ ...die })))
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

  const stageDice = useMemo(
    () => diceSnapshotRef.current.map((die) => ({ id: die.id, type: die.type })),
    [rollSessionId],
  )

  const handleRollResults = useCallback(
    (results: RollResultEntry[]) => {
      finalizeResults(results)
    },
    [finalizeResults],
  )

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
      <DiceRollStage
        dice={stageDice}
        rollSessionId={rollSessionId}
        visible={visible}
        debugSettings={debugSettings}
        predeterminedValues={predeterminedValues}
        onRollResult={handleRollResults}
      />
      <DiceResultsSummary
        dice={dice}
        tallies={tallies}
        numericMode={numericMode}
        settled={settled}
        onClose={onClose}
      />
    </>
  )
}
