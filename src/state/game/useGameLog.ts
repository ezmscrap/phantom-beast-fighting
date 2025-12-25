import { useCallback, useMemo, useState } from 'react'
import type { GameLogEntry, GameSnapshot } from '../../types'
import { deepClone } from '../../utils/deepClone'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface UseGameLogOptions {
  playbackDelayMs?: number
}

export const useGameLog = ({ playbackDelayMs = 1000 }: UseGameLogOptions = {}) => {
  const [logs, setLogs] = useState<GameLogEntry[]>([])
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [uploadedLogs, setUploadedLogs] = useState<GameLogEntry[]>([])
  const [isReplaying, setIsReplaying] = useState(false)

  const recordLog = useCallback((entry: GameLogEntry) => {
    setLogs((prev) => [...prev, entry])
  }, [])

  const downloadLogs = useCallback(() => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `phantom-beast-log-${Date.now()}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [logs])

  const handleUpload = useCallback(async (file: File) => {
    const text = await file.text()
    const data = JSON.parse(text) as GameLogEntry[]
    setUploadedLogs(data)
    return data
  }, [])

  const canReplay = useMemo(() => uploadedLogs.length > 0 && !isReplaying, [uploadedLogs.length, isReplaying])

  const toggleCollapsed = useCallback(() => setIsCollapsed((prev) => !prev), [])

  const replayFromLogs = useCallback(
    async (
      applySnapshot: (snapshot: GameSnapshot) => void,
      entries?: GameLogEntry[],
      onEntry?: (entry: GameLogEntry) => void | Promise<void>,
    ) => {
      const source = entries ?? uploadedLogs
      if (!source.length || isReplaying) return
      setIsReplaying(true)
      for (const entry of source) {
        await delay(playbackDelayMs)
        await onEntry?.(entry)
        applySnapshot(deepClone(entry.afterState))
      }
      setIsReplaying(false)
    },
    [uploadedLogs, isReplaying, playbackDelayMs],
  )

  return {
    logs,
    recordLog,
    downloadLogs,
    handleUpload,
    uploadedLogs,
    canReplay,
    replayFromLogs,
    isCollapsed,
    toggleCollapsed,
    isReplaying,
  }
}
