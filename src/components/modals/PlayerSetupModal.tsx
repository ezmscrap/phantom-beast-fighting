import { Modal } from '../Modal'
import type { PlayerId } from '../../types'

type Stage = 'names' | 'confirmNames' | 'initiative' | 'confirmInitiative'

interface PlayerSetupModalProps {
  isOpen: boolean
  nameStage: Stage
  nameDrafts: Record<PlayerId, string>
  nameLocks: Record<PlayerId, boolean>
  initiativeChoice: PlayerId
  onDraftChange: (player: PlayerId, value: string) => void
  onLockName: (player: PlayerId) => void
  onChangeStage: (stage: Stage) => void
  onSelectInitiative: (player: PlayerId) => void
  onConfirmInitiative: () => void
}

export const PlayerSetupModal = ({
  isOpen,
  nameStage,
  nameDrafts,
  nameLocks,
  initiativeChoice,
  onDraftChange,
  onLockName,
  onChangeStage,
  onSelectInitiative,
  onConfirmInitiative,
}: PlayerSetupModalProps) => {
  const readyForConfirmation = nameLocks.A && nameLocks.B

  return (
    <Modal title="プレイヤー設定" isOpen={isOpen}>
      {nameStage === 'names' && (
        <div className="name-stage">
          {(['A', 'B'] as PlayerId[]).map((id) => (
            <div key={id} className="name-row">
              <label>
                {id}の名前
                <input
                  value={nameDrafts[id]}
                  disabled={nameLocks[id]}
                  onChange={(event) => onDraftChange(id, event.target.value)}
                />
              </label>
              <button disabled={nameLocks[id]} onClick={() => onLockName(id)}>
                決定
              </button>
            </div>
          ))}
          {readyForConfirmation ? (
            <button onClick={() => onChangeStage('confirmNames')}>この名前で確認</button>
          ) : null}
        </div>
      )}

      {nameStage === 'confirmNames' && (
        <div>
          <p>
            A: {nameDrafts.A} / B: {nameDrafts.B} でよいですか？
          </p>
          <div className="modal-actions">
            <button onClick={() => onChangeStage('initiative')}>確認</button>
            <button onClick={() => onChangeStage('names')}>戻る</button>
          </div>
        </div>
      )}

      {nameStage === 'initiative' && (
        <div>
          <p>先行プレイヤーを選択してください。</p>
          {(['A', 'B'] as PlayerId[]).map((id) => (
            <label key={id} className="radio-row">
              <input type="radio" checked={initiativeChoice === id} onChange={() => onSelectInitiative(id)} />
              {nameDrafts[id]}
            </label>
          ))}
          <button onClick={() => onChangeStage('confirmInitiative')}>先行決定</button>
        </div>
      )}

      {nameStage === 'confirmInitiative' && (
        <div>
          <p>{nameDrafts[initiativeChoice]}を先行にします。よろしいですか？</p>
          <div className="modal-actions">
            <button onClick={onConfirmInitiative}>確認</button>
            <button onClick={() => onChangeStage('initiative')}>戻る</button>
          </div>
        </div>
      )}
    </Modal>
  )
}
