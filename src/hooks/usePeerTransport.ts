import { useCallback, useEffect, useRef, useState } from 'react'
import Peer, { type DataConnection } from 'peerjs'
import type { ConnectionStatus, GameLogEntry, MatchMode, PlayerId, TransportPayload } from '../types'

const createMessageId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

interface BroadcastOptions {
  entries?: GameLogEntry[]
  logs?: GameLogEntry[]
}

export const usePeerTransport = () => {
  const peerRef = useRef<Peer | null>(null)
  const [peerId, setPeerId] = useState<string | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const connectionsRef = useRef<Set<DataConnection>>(new Set())
  const latestLogsRef = useRef<GameLogEntry[]>([])
  const logHandlerRef = useRef<(entries: GameLogEntry[]) => void>(() => {})
  const handshakeHandlerRef = useRef<(payload: { role: MatchMode; userName: string; playerRole: PlayerId }) => void>(() => {})
  const knownMessages = useRef<Set<string>>(new Set())

  const cleanupConnection = useCallback((conn: DataConnection) => {
    connectionsRef.current.delete(conn)
    if (connectionsRef.current.size === 0) {
      setStatus(peerRef.current ? 'waiting' : 'idle')
    }
  }, [])

  const forwardPayload = useCallback((payload: TransportPayload, source?: DataConnection) => {
    connectionsRef.current.forEach((conn) => {
      if (conn === source) return
      if (conn.open) {
        try {
          conn.send(payload)
        } catch {
          cleanupConnection(conn)
        }
      }
    })
  }, [cleanupConnection])

  const handlePayload = useCallback(
    (payload: TransportPayload, source: DataConnection) => {
      if (knownMessages.current.has(payload.messageId)) {
        return
      }
      knownMessages.current.add(payload.messageId)
      if (payload.kind === 'logSnapshot') {
        if (payload.logs?.length) {
          latestLogsRef.current = payload.logs
          logHandlerRef.current(payload.logs)
        }
      } else if (payload.kind === 'logAppend') {
        if (payload.entries?.length) {
          latestLogsRef.current = [...latestLogsRef.current, ...payload.entries]
          logHandlerRef.current(payload.entries)
        }
      } else if (payload.kind === 'handshake') {
        handshakeHandlerRef.current({
          role: payload.role,
          userName: payload.userName,
          playerRole: payload.playerRole,
        })
      }
      forwardPayload(payload, source)
    },
    [forwardPayload],
  )

  const setupConnection = useCallback(
    (conn: DataConnection) => {
      connectionsRef.current.add(conn)
      conn.on('open', () => {
        setStatus('connected')
        if (latestLogsRef.current.length) {
          const payload: TransportPayload = {
            kind: 'logSnapshot',
            logs: latestLogsRef.current,
            messageId: createMessageId(),
            origin: peerRef.current?.id ?? 'unknown',
          }
          conn.send(payload)
        }
      })
      conn.on('data', (data) => {
        handlePayload(data as TransportPayload, conn)
      })
      conn.on('close', () => {
        cleanupConnection(conn)
      })
      conn.on('error', () => cleanupConnection(conn))
    },
    [cleanupConnection, handlePayload],
  )

  const initializePeer = useCallback(async () => {
    if (peerRef.current) return peerRef.current
    const peer = new Peer()
    peerRef.current = peer
    setStatus('waiting')
    peer.on('open', (id) => {
      setPeerId(id)
    })
    peer.on('connection', (conn) => {
      setupConnection(conn)
    })
    peer.on('disconnected', () => {
      setStatus('waiting')
    })
    peer.on('close', () => {
      setStatus('idle')
      peerRef.current = null
    })
    return peer
  }, [setupConnection])

  const connectToPeer = useCallback(
    async (targetId: string) => {
      const peer = peerRef.current ?? (await initializePeer())
      setStatus('connecting')
      const connection = peer.connect(targetId)
      setupConnection(connection)
    },
    [initializePeer, setupConnection],
  )

  const broadcast = useCallback(
    ({ entries, logs }: BroadcastOptions) => {
      if (!entries?.length && !logs?.length) return
      const payload: TransportPayload = entries
        ? { kind: 'logAppend', entries, messageId: createMessageId(), origin: peerRef.current?.id ?? 'unknown' }
        : { kind: 'logSnapshot', logs: logs ?? [], messageId: createMessageId(), origin: peerRef.current?.id ?? 'unknown' }
      if (payload.kind === 'logSnapshot' && logs) {
        latestLogsRef.current = logs
      } else if (payload.kind === 'logAppend' && entries) {
        latestLogsRef.current = [...latestLogsRef.current, ...entries]
      }
      forwardPayload(payload)
    },
    [forwardPayload],
  )

  const sendHandshake = useCallback(
    (role: MatchMode, userName: string, playerRole: PlayerId) => {
      const payload: TransportPayload = {
        kind: 'handshake',
        role,
        userName,
        playerRole,
        messageId: createMessageId(),
        origin: peerRef.current?.id ?? 'unknown',
      }
      forwardPayload(payload)
    },
    [forwardPayload],
  )

  useEffect(
    () => () => {
      peerRef.current?.destroy()
      peerRef.current = null
      connectionsRef.current.clear()
    },
    [],
  )

  return {
    peerId,
    status,
    initializePeer,
    connectToPeer,
    broadcast,
    sendHandshake,
    setLatestLogs: (logs: GameLogEntry[]) => {
      latestLogsRef.current = logs
    },
    setLogHandler: (handler: (entries: GameLogEntry[]) => void) => {
      logHandlerRef.current = handler
    },
    setHandshakeHandler: (handler: (payload: { role: MatchMode; userName: string; playerRole: PlayerId }) => void) => {
      handshakeHandlerRef.current = handler
    },
  }
}
