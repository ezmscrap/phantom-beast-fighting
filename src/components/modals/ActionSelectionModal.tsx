import { Modal } from '../Modal'
import type { ActionSelectionState, ActionType, PlayerId, PlayerState } from '../../types'
import { playAudio } from '../../audio'

interface ActionSelectionModalProps {
  selection: ActionSelectionState | null
  players: Record<PlayerId, PlayerState>
  onSelect: (player: PlayerId, value: ActionType) => void
  onConfirm: () => void
  onCancel: () => void
}

/** ラジオボタンに表示するアクション種別の説明文。 */
const optionLabels: Record<ActionType, string> = {
  standard: '通常アクション（エネルギー消費0）',
  strategy: '作戦アクション（エネルギー1）',
  comeback: '起死回生アクション（エネルギー3）',
}

/**
 * 次アクション選択モーダル。
 * selection が存在する場合のみ開き、確定時に onConfirm を呼び出す。
 */
export const ActionSelectionModal = ({ selection, players, onSelect, onConfirm, onCancel }: ActionSelectionModalProps) => (
  <Modal
    title="次アクション選択"
    isOpen={Boolean(selection)}
    onClose={onCancel}
    footer={
      <div className="modal-actions">
        <button
          onClick={() => {
            playAudio('button')
            onConfirm()
          }}
        >
          決定
        </button>
        <button
          className="ghost"
          onClick={() => {
            playAudio('button')
            onCancel()
          }}
        >
          キャンセル
        </button>
      </div>
    }
  >
    {selection ? (
      <div>
        <p>{players[selection.player].name}の行動を選択してください。</p>
        {(['standard', 'strategy', 'comeback'] as ActionType[]).map((value) => (
          <label key={value} className="radio-row">
            <input
              type="radio"
              checked={selection.value === value}
              onChange={() => onSelect(selection.player, value)}
              disabled={
                (value === 'comeback' && players[selection.player].energy < 3) ||
                (value === 'strategy' && players[selection.player].energy === 0)
              }
            />
            {optionLabels[value]}
          </label>
        ))}
      </div>
    ) : null}
  </Modal>
)
