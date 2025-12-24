import { classDisplayNames, baseDisplayNames, stepDescriptions } from '../../constants'
import type {
  ActionSelectionState,
  GameLogEntry,
  MovementBudget,
  MovementState,
  PlayerId,
  PlayerState,
  ProcedureStep,
  Unit,
} from '../../types'
import type { ChangeEvent, ReactNode } from 'react'
import { playAudio } from '../../audio'
import { createUnitLabel } from '../../state/gameState'

export interface PlayerSidebarProps {
  players: Record<PlayerId, PlayerState>
  leadingPlayer: PlayerId
  activePlayer: PlayerId
  step: ProcedureStep
  remainingByClass: Record<PlayerId, MovementBudget>
  actionSelection: ActionSelectionState | null
  onActionSelect: (player: PlayerId, value: 'standard') => void
  renderProcedureControls: () => ReactNode
  canProceed: boolean
  onCompleteStep: () => void
  isCreationStep: boolean
  isEnergySelectionStep: boolean
  movementState: MovementState | null
  activeMovementUnits: Unit[]
  onSelectUnitForMovement: (unit: Unit) => void
  logs: GameLogEntry[]
  onDownloadLogs: () => void
  onUploadLogs: (file: File) => void
  canReplayLogs: boolean
  onReplayLogs: () => void
  logPanelCollapsed: boolean
  onToggleLogPanel: () => void
  isReplayingLogs: boolean
}

export const PlayerSidebar = ({
  players,
  leadingPlayer,
  activePlayer,
  step,
  remainingByClass,
  actionSelection,
  onActionSelect,
  renderProcedureControls,
  canProceed,
  onCompleteStep,
  isCreationStep,
  isEnergySelectionStep,
  movementState,
  activeMovementUnits,
  onSelectUnitForMovement,
  logs,
  onDownloadLogs,
  onUploadLogs,
  canReplayLogs,
  onReplayLogs,
  logPanelCollapsed,
  onToggleLogPanel,
  isReplayingLogs,
}: PlayerSidebarProps) => {
  const handleLogFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      playAudio('button')
      onUploadLogs(file)
    }
    event.target.value = ''
  }

  const formatTimestamp = (value: string) => new Date(value).toLocaleString('ja-JP')

  return (
    <aside className="sidebar">
      {(['A', 'B'] as PlayerId[]).map((playerId) => {
        const isActive = activePlayer === playerId
        return (
          <section key={playerId} className={`player-panel ${isActive ? 'is-active' : ''}`}>
          <header>
            <h2>
              {players[playerId].name} <small>{playerId === leadingPlayer ? '（先行）' : ''}</small>
            </h2>
          </header>
          <div className="energy-track">
            {[3, 2, 1].map((threshold, index) => (
              <span key={threshold} className={`token ${players[playerId].energy >= threshold ? 'lit' : ''}`} aria-label={`T${3 - index}`} />
            ))}
            <p>エネルギー: {players[playerId].energy}</p>
          </div>
          <div className="class-counts">
            {(Object.keys(classDisplayNames) as (keyof typeof classDisplayNames)[]).map((role) => (
              <div key={role} className="count-row">
                <span>{classDisplayNames[role]}</span>
                <strong>{remainingByClass[playerId]?.[role] ?? 0}</strong>
              </div>
            ))}
          </div>
          {isCreationStep ? (
            <div className="card-counts">
              <p>ユニット作成用カード</p>
              <ul>
                {(Object.keys(baseDisplayNames) as (keyof typeof baseDisplayNames)[]).map((base) => (
                  <li key={base}>
                    {baseDisplayNames[base]}: {players[playerId].baseCards[base]}
                  </li>
                ))}
              </ul>
              <ul>
                {(Object.keys(classDisplayNames) as (keyof typeof classDisplayNames)[]).map((role) => (
                  <li key={role}>
                    {classDisplayNames[role]}: {players[playerId].classCards[role]}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {isEnergySelectionStep ? (
            <button
              disabled={actionSelection?.player === playerId}
              onClick={() => {
                playAudio('button')
                onActionSelect(playerId, 'standard')
              }}
            >
              次アクション選択
            </button>
          ) : null}
        </section>
      )
    })}
    <section className="procedure-panel">
      <h2>現在の手順</h2>
      <p>
        手順{step}: {stepDescriptions[step]}
      </p>
      <p>対象プレイヤー: {players[activePlayer].name}</p>
      <div className="procedure-actions">{renderProcedureControls()}</div>
      <button
        disabled={!canProceed}
        onClick={() => {
          playAudio('button')
          onCompleteStep()
        }}
      >
        手順完了
      </button>
    </section>
    <section className={`log-panel ${logPanelCollapsed ? 'is-collapsed' : ''}`}>
      <header className="log-panel__header">
        <h3>操作ログ</h3>
        <button
          className="ghost"
          onClick={() => {
            playAudio('button')
            onToggleLogPanel()
          }}
        >
          {logPanelCollapsed ? '展開' : '最小化'}
        </button>
      </header>
      {logPanelCollapsed ? null : (
        <>
          <div className="log-panel__list">
            {logs.length === 0 ? (
              <p className="log-panel__empty">まだログはありません。</p>
            ) : (
              logs.map((entry) => (
                <div key={entry.id} className="log-entry">
                  <div className="log-entry__meta">
                    <span>手順{entry.step}</span>
                    <span>{formatTimestamp(entry.timestamp)}</span>
                  </div>
                  <p>
                    <strong>{entry.actor}</strong>:{' '}
                    <span>{entry.action}</span>
                    {entry.detail ? `（${entry.detail}）` : ''}
                  </p>
                </div>
              ))
            )}
          </div>
          <div className="log-panel__actions">
            <button
              onClick={() => {
                playAudio('button')
                onDownloadLogs()
              }}
            >
              ログのダウンロード
            </button>
            <label className="log-upload-button">
              <input type="file" accept="application/json" onChange={handleLogFile} />
              <span>ログのアップロード</span>
            </label>
            <button
              disabled={!canReplayLogs || isReplayingLogs}
              onClick={() => {
                playAudio('button')
                onReplayLogs()
              }}
            >
              {isReplayingLogs ? '再生中…' : 'ログを再生'}
            </button>
          </div>
        </>
      )}
    </section>
    {movementState ? (
      <section className="movement-panel">
        <h3>兵種別移動可能数</h3>
        <ul>
          <li>剣士: {movementState.budget.swordsman}</li>
          <li>魔術師: {movementState.budget.mage}</li>
          <li>策士: {movementState.budget.tactician}</li>
        </ul>
        <p>{players[movementState.player].name}の移動を完了してください。</p>
        <div className="unit-selection">
          {activeMovementUnits.map((unit) => (
            <button key={unit.id} onClick={() => onSelectUnitForMovement(unit)}>
              {createUnitLabel(unit)}
            </button>
          ))}
        </div>
      </section>
    ) : null}
    </aside>
  )
}
