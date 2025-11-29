import { classDisplayNames, baseDisplayNames, stepDescriptions } from '../../constants'
import type { ActionSelectionState, MovementState, PlayerId, PlayerState, ProcedureStep, Unit, MovementBudget } from '../../types'
import type { ReactNode } from 'react'
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
}: PlayerSidebarProps) => (
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
