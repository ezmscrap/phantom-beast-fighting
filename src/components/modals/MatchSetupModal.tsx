import { useEffect, useState } from 'react'
import { Modal } from '../Modal'
import type { MatchMode, PeerInfo } from '../../types'
import { playAudio } from '../../audio'

interface MatchSetupModalProps {
  isOpen: boolean
  userName: string
  activeMode: MatchMode | null
  peerInfo: PeerInfo
  onUserNameChange: (value: string) => void
  onStartLocal: (name: string) => void
  onStartOnline: (name: string) => void
  onStartSpectator: (name: string) => void
  onConnect: (targetId: string) => void
}

export const MatchSetupModal = ({
  isOpen,
  userName,
  activeMode,
  peerInfo,
  onUserNameChange,
  onStartLocal,
  onStartOnline,
  onStartSpectator,
  onConnect,
}: MatchSetupModalProps) => {
  const [modeSelection, setModeSelection] = useState<MatchMode | null>(null)
  const [targetId, setTargetId] = useState('')

  useEffect(() => {
    if (isOpen) {
      setModeSelection(activeMode ?? null)
      setTargetId('')
    }
  }, [isOpen, activeMode])

  const handleModeClick = (mode: MatchMode) => {
    if (modeSelection === mode) return
    setModeSelection(mode)
    playAudio('button')
    if (mode === 'local') {
      onStartLocal(userName)
    } else if (mode === 'online') {
      onStartOnline(userName)
    } else {
      onStartSpectator(userName)
    }
  }

  const isConnectDisabled = targetId.trim().length <= 0

  return (
    <Modal title="対戦形式を選択" isOpen={isOpen}>
      <div className="match-setup">
        <label className="match-setup__name">
          ユーザー名
          <input value={userName} onChange={(event) => onUserNameChange(event.target.value)} />
        </label>
        {!modeSelection ? (
          <div className="match-setup__choices">
            <button onClick={() => handleModeClick('local')}>1ブラウザで対戦</button>
            <button onClick={() => handleModeClick('online')}>通信で対戦</button>
            <button onClick={() => handleModeClick('spectator')}>対戦を観戦</button>
          </div>
        ) : null}
        {modeSelection === 'online' ? (
          <div className="match-setup__panel">
            <p>プレイヤーID: {peerInfo.id ?? '取得中...'}</p>
            <p>接続状況: {peerInfo.status}</p>
            <label>
              接続先のプレイヤーの通信用ID
              <input
                placeholder="相手のID"
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
              />
            </label>
            <button
              disabled={isConnectDisabled}
              onClick={() => {
                playAudio('button')
                onConnect(targetId.trim())
              }}
            >
              接続
            </button>
          </div>
        ) : null}
        {modeSelection === 'spectator' ? (
          <div className="match-setup__panel">
            <p>中継用ID: {peerInfo.id ?? '取得中...'}</p>
            <label>
              接続先のゲームボードの通信用ID
              <input
                placeholder="ホストのID"
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
              />
            </label>
            <button
              disabled={isConnectDisabled}
              onClick={() => {
                playAudio('button')
                onConnect(targetId.trim())
              }}
            >
              接続
            </button>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
