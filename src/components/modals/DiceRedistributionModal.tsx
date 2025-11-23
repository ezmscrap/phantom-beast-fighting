import { Modal } from '../Modal'
import type { DiceRedistributionState } from '../../types'

interface DiceRedistributionModalProps {
  state: DiceRedistributionState | null
  choice: 'R1' | 'R2' | 'R3'
  onSelect: (slot: 'R1' | 'R2' | 'R3') => void
  onConfirm: () => void
  onCancel: () => void
}

export const DiceRedistributionModal = ({ state, choice, onSelect, onConfirm, onCancel }: DiceRedistributionModalProps) => (
  <Modal
    title="サイコロ再配置"
    isOpen={Boolean(state)}
    onClose={onCancel}
    footer={
      state ? (
        <div className="modal-actions">
          <button onClick={onConfirm}>決定</button>
          <button className="ghost" onClick={onCancel}>
            キャンセル
          </button>
        </div>
      ) : null
    }
  >
    {state ? (
      <div>
        <p>
          {state.type === 'strategy'
            ? '金サイコロを配置するスロットを選択してください。R1には銀を配置します。'
            : '金サイコロを配置するスロットを１つ選びます。'}
        </p>
        {state.options.map((slot) => (
          <label key={slot} className="radio-row">
            <input type="radio" checked={choice === slot} onChange={() => onSelect(slot)} />
            {slot}
          </label>
        ))}
      </div>
    ) : null}
  </Modal>
)
