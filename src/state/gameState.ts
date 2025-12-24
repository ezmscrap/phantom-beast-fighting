import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ConnectionStatus,
  GameLogEntry,
  GameSnapshot,
  MatchMode,
  PlayerId,
  ProcedureStep,
} from '../types'
import { useUnitLogic } from './game/useUnitLogic'
import { useMovementLogic } from './game/useMovementLogic'
import { useActionPlanLogic } from './game/useActionPlanLogic'
import { useGameLog } from './game/useGameLog'
import { deepClone } from '../utils/deepClone'
import { usePeerTransport } from '../hooks/usePeerTransport'
export { createUnitLabel } from './game/helpers'

type PendingLog = {
  meta: Omit<GameLogEntry, 'id' | 'timestamp' | 'beforeState' | 'afterState'>
  beforeState: GameSnapshot
}

export const useGameState = () => {
  const [step, setStep] = useState<ProcedureStep>(0)
  const [leadingPlayer, setLeadingPlayer] = useState<PlayerId>('A')
  const [nameStage, setNameStage] = useState<'names' | 'confirmNames' | 'initiative' | 'confirmInitiative'>('names')
  const [nameDrafts, setNameDrafts] = useState({ A: 'プレイヤーA', B: 'プレイヤーB' })
  const [nameLocks, setNameLocks] = useState({ A: false, B: false })
  const [initiativeChoice, setInitiativeChoice] = useState<PlayerId>('A')
  const [matchMode, setMatchMode] = useState<MatchMode | null>(null)
  const [userName, setUserName] = useState('プレイヤーA')
  const [onlineRole, setOnlineRole] = useState<PlayerId | null>(null)
  const [peerState, setPeerState] = useState<{ id: string | null; status: ConnectionStatus }>({
    id: null,
    status: 'idle',
  })
  const snapshotRef = useRef<GameSnapshot | null>(null)
  const pendingLogsRef = useRef<PendingLog[]>([])
  const prevLogCountRef = useRef(0)

  const {
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
  } = useGameLog()
  const {
    peerId,
    status: transportStatus,
    initializePeer,
    connectToPeer,
    broadcast,
    sendHandshake,
    setLatestLogs,
    setLogHandler,
    setHandshakeHandler,
  } = usePeerTransport()

  const pushLogEntry = useCallback(
    (entry: Omit<GameLogEntry, 'id' | 'timestamp'>) => {
      const id = `log-${Date.now()}-${Math.random().toString(16).slice(2)}`
      recordLog({ ...entry, id, timestamp: new Date().toISOString() })
    },
    [recordLog],
  )

  const getSnapshot = useCallback(() => (snapshotRef.current ? deepClone(snapshotRef.current) : null), [])

  const queueLog = useCallback(
    (meta: Omit<GameLogEntry, 'id' | 'timestamp' | 'beforeState' | 'afterState'>) => {
      const beforeState = getSnapshot()
      if (!beforeState) return
      pendingLogsRef.current.push({ meta, beforeState })
    },
    [getSnapshot],
  )

  const getCurrentStep = useCallback(() => step, [step])

  const {
    players,
    setPlayers,
    units,
    setUnits,
    unitCounter,
    setUnitCounter,
    placementState,
    setPlacementState,
    creationRequest,
    setCreationRequest,
    creationSelection,
    setCreationSelection,
    miniBoardState,
    setMiniBoardState,
    victor,
    setVictor,
    boardMap,
    remainingByClass,
    creationRemaining,
    activePlacementUnits,
    currentPlacementTargets,
    increaseEnergy,
    decreaseEnergy,
    handleCreateUnit,
    handlePlaceUnit,
    handleSwapSelection,
    placementSelectionHandler,
    toggleSwapMode,
    handleMiniBoardClick,
    cancelMiniBoard,
    handleRemoveUnit,
    resetUnitState,
    finalizeTentativePlacements,
    swapRestrictionWarning,
    dismissSwapRestrictionWarning,
  } = useUnitLogic({ queueLog, getCurrentStep })

  const {
    actionSelection,
    setActionSelection,
    nextActions,
    setNextActions,
    handleActionSelection,
    confirmAction,
    resetActionPlan,
  } = useActionPlanLogic({ players, decreaseEnergy })

  const {
    movementState,
    setMovementState,
    activeMovementUnits,
    handleSelectUnitForMovement,
    handleMoveUnit,
    resetMovementState,
  } = useMovementLogic({
    units,
    setUnits,
    boardMap,
    increaseEnergy,
    handleRemoveUnit,
    setNextActions,
    queueLog,
    getCurrentStep,
  })

  const hostPeerIdRef = useRef<string | null>(null)

  useEffect(() => {
    setPeerState({ id: peerId ?? null, status: transportStatus })
  }, [peerId, transportStatus])

  const goToNextStep = useCallback(() => {
    queueLog({ step, actor: 'system', action: 'advanceStep', detail: `from ${step}`, target: 'procedure' })
    setStep((prev) => {
      if (prev === 16) {
        return 7
      }
      return ((prev + 1) as ProcedureStep)
    })
  }, [queueLog, step])

  useEffect(() => {
    finalizeTentativePlacements()
  }, [step, finalizeTentativePlacements])

  const snapshot = useMemo(
    () =>
      deepClone({
        step,
        leadingPlayer,
        players,
        units,
        unitCounter,
        placementState,
        creationRequest,
        creationSelection,
        miniBoardState,
        movementState,
        actionSelection,
        nextActions,
        nameStage,
        nameDrafts,
        nameLocks,
        initiativeChoice,
        victor,
      }) as GameSnapshot,
    [
      step,
      leadingPlayer,
      players,
      units,
      unitCounter,
      placementState,
      creationRequest,
      creationSelection,
      miniBoardState,
      movementState,
      actionSelection,
      nextActions,
      nameStage,
      nameDrafts,
      nameLocks,
      initiativeChoice,
      victor,
    ],
  )

  useEffect(() => {
    snapshotRef.current = snapshot
  }, [snapshot])

  useEffect(() => {
    if (pendingLogsRef.current.length === 0) return
    const pending = pendingLogsRef.current.shift()
    if (!pending) return
    const afterState = getSnapshot()
    if (!afterState) return
    pushLogEntry({ ...pending.meta, beforeState: pending.beforeState, afterState })
  }, [
    players,
    units,
    placementState,
    movementState,
    actionSelection,
    nextActions,
    creationRequest,
    creationSelection,
    miniBoardState,
    nameStage,
    nameDrafts,
    nameLocks,
    initiativeChoice,
    victor,
    step,
    leadingPlayer,
    getSnapshot,
    pushLogEntry,
  ])

  useEffect(() => {
    if (!matchMode || matchMode === 'spectator') return
    if (logs.length === 0) return
    if (prevLogCountRef.current === 0) {
      broadcast({ logs })
    } else if (logs.length > prevLogCountRef.current) {
      const entries = logs.slice(prevLogCountRef.current)
      broadcast({ entries })
    }
    prevLogCountRef.current = logs.length
  }, [logs, matchMode, broadcast])

  useEffect(() => {
    if (!matchMode) return
    if (transportStatus !== 'connected') return
    if (matchMode === 'online') {
      if (!onlineRole) return
      sendHandshake(matchMode, userName, onlineRole)
    } else {
      sendHandshake(matchMode, userName, 'A')
    }
  }, [matchMode, transportStatus, sendHandshake, userName, onlineRole])

  useEffect(() => {
    if (matchMode !== 'online') return
    if (onlineRole === 'B') {
      setPlayers((prev) => ({
        ...prev,
        B: { ...prev.B, name: userName },
      }))
      setNameDrafts((prev) => ({ ...prev, B: userName }))
    }
  }, [matchMode, onlineRole, setPlayers, setNameDrafts, userName])

  useEffect(() => {
    if (step !== 0) return
    if (!matchMode || matchMode === 'local') return
    if (transportStatus === 'connected') {
      setStep(1)
    }
  }, [step, matchMode, transportStatus])

  const applySnapshot = useCallback(
    (state: GameSnapshot) => {
      const clone = deepClone(state)
      setStep(clone.step)
      setLeadingPlayer(clone.leadingPlayer)
      setPlayers(clone.players)
      setUnits(clone.units)
      setUnitCounter(clone.unitCounter)
      setPlacementState(clone.placementState)
      setCreationRequest(clone.creationRequest)
      setCreationSelection(clone.creationSelection)
      setMiniBoardState(clone.miniBoardState)
      setMovementState(clone.movementState)
      setActionSelection(clone.actionSelection)
      setNextActions(clone.nextActions)
      setNameStage(clone.nameStage)
      setNameDrafts(clone.nameDrafts)
      setNameLocks(clone.nameLocks)
      setInitiativeChoice(clone.initiativeChoice)
      setVictor(clone.victor)
    },
    [
      setActionSelection,
      setCreationRequest,
      setCreationSelection,
      setInitiativeChoice,
      setLeadingPlayer,
      setMiniBoardState,
      setMovementState,
      setNameDrafts,
      setNameLocks,
      setNameStage,
      setNextActions,
      setPlacementState,
      setPlayers,
      setStep,
      setUnits,
      setUnitCounter,
      setVictor,
    ],
  )

  const handleReplayLogs = useCallback(
    async (entries?: GameLogEntry[]) => {
      const source = entries ?? uploadedLogs
      if (!source.length) return
      const firstSnapshot = source[0]?.beforeState
      if (firstSnapshot) {
        applySnapshot(firstSnapshot)
      }
      await replayFromLogs(applySnapshot, source)
    },
    [applySnapshot, replayFromLogs, uploadedLogs],
  )

  const handleLogUpload = useCallback((file: File) => handleUpload(file), [handleUpload])

  const uploadLogsAndReplay = useCallback(
    async (file: File) => {
      const entries = await handleLogUpload(file)
      if (!entries?.length) return
      const firstSnapshot = entries[0].beforeState
      if (firstSnapshot) {
        applySnapshot(firstSnapshot)
      }
      await handleReplayLogs(entries)
    },
    [handleLogUpload, handleReplayLogs, applySnapshot],
  )

  useEffect(() => {
    setLogHandler((entries) => {
      handleReplayLogs(entries)
    })
  }, [handleReplayLogs, setLogHandler])

  useEffect(() => {
    setHandshakeHandler(({ role, userName: remoteName, playerRole }) => {
      if (role !== 'online') return
      if (playerRole === 'A') {
        setPlayers((prev) => ({
          ...prev,
          A: { ...prev.A, name: remoteName },
        }))
        setNameDrafts((prev) => ({ ...prev, A: remoteName }))
        setOnlineRole('B')
      } else if (playerRole === 'B') {
        setPlayers((prev) => ({
          ...prev,
          B: { ...prev.B, name: remoteName },
        }))
        setNameDrafts((prev) => ({ ...prev, B: remoteName }))
      }
    })
  }, [setHandshakeHandler, setPlayers, setNameDrafts])

  useEffect(() => {
    setLatestLogs(logs)
  }, [logs, setLatestLogs])

  const startLocalMatch = useCallback(
    async (name: string) => {
      setUserName(name)
      setMatchMode('local')
      setPlayers((prev) => ({
        ...prev,
        A: { ...prev.A, name },
      }))
      setNameDrafts((prev) => ({ ...prev, A: name }))
      await initializePeer()
      setPeerState((prev) => ({ ...prev, status: 'waiting' }))
      setStep(1)
    },
    [initializePeer, setPlayers],
  )

  const startSpectatorMode = useCallback(
    async (name: string) => {
      setUserName(name)
      setMatchMode('spectator')
      await initializePeer()
      setPeerState((prev) => ({ ...prev, status: 'waiting' }))
    },
    [initializePeer],
  )

  const startOnlineMatch = useCallback(
    async (name: string) => {
      setUserName(name)
      setMatchMode('online')
      setOnlineRole(null)
      setPlayers((prev) => ({
        ...prev,
        A: { ...prev.A, name },
        B: { ...prev.B, name: 'プレイヤーB' },
      }))
      setNameDrafts((prev) => ({ ...prev, A: name }))
      await initializePeer()
      setPeerState((prev) => ({ ...prev, status: 'waiting' }))
      setNameStage('initiative')
    },
    [initializePeer, setPlayers, setNameStage],
  )

  const connectMatchPeer = useCallback(
    async (targetId: string) => {
      if (!targetId) return
      await connectToPeer(targetId)
      hostPeerIdRef.current = peerId ?? null
      setOnlineRole('A')
      sendHandshake('online', userName, 'A')
    },
    [connectToPeer, peerId, sendHandshake, userName],
  )

  const confirmLeadingPlayer = useCallback(
    (player: PlayerId) => {
      queueLog({ step, actor: 'system', action: 'setLeading', detail: player, target: 'initiative' })
      setLeadingPlayer(player)
    },
    [queueLog, step],
  )

  const resetGame = () => {
    resetUnitState()
    resetMovementState()
    resetActionPlan()
    setStep(0)
    setLeadingPlayer('A')
    setNameStage('names')
    setNameLocks({ A: false, B: false })
    setNameDrafts({ A: 'プレイヤーA', B: 'プレイヤーB' })
    setInitiativeChoice('A')
    setMatchMode(null)
    setUserName('プレイヤーA')
    setPeerState({ id: null, status: 'idle' })
    setOnlineRole(null)
  }

  return {
    players,
    units,
    step,
    leadingPlayer,
    placementState,
    movementState,
    actionSelection,
    nextActions,
    creationRequest,
    creationSelection,
    miniBoardState,
    nameStage,
    nameDrafts,
    nameLocks,
    initiativeChoice,
    victor,
    boardMap,
    remainingByClass,
    activePlacementUnits,
    currentPlacementTargets,
    creationRemaining,
    activeMovementUnits,
    setPlayers,
    setUnits,
    setStep,
    setLeadingPlayer,
    setNameStage,
    setNameDrafts,
    setNameLocks,
    setInitiativeChoice,
    setCreationRequest,
    setCreationSelection,
    setPlacementState,
    setMiniBoardState,
    setMovementState,
    setActionSelection,
    setNextActions,
    setVictor,
    handleCreateUnit,
    handlePlaceUnit,
    handleSelectUnitForMovement,
    handleMoveUnit,
    handleActionSelection,
    confirmAction,
    handleMiniBoardClick,
    cancelMiniBoard,
    handleSwapSelection,
    placementSelectionHandler,
    toggleSwapMode,
    goToNextStep,
    resetGame,
    swapRestrictionWarning,
    dismissSwapRestrictionWarning,
    matchMode,
    onlineRole,
    setMatchMode,
    userName,
    setUserName,
    peerInfo: peerState,
    startLocalMatch,
    startSpectatorMode,
    startOnlineMatch,
    connectMatchPeer,
    confirmLeadingPlayer,
    logs,
    downloadLogs,
    handleLogUpload,
    uploadedLogs,
    canReplay,
    handleReplayLogs,
    uploadLogsAndReplay,
    isLogPanelCollapsed: isCollapsed,
    toggleLogPanel: toggleCollapsed,
    isLogReplaying: isReplaying,
  }
}
