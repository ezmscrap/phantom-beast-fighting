import { Modal } from '../Modal'
import { baseDisplayNames, classDisplayNames } from '../../constants'
import type {
  BaseType,
  ClassType,
  PlayerId,
  PlayerState,
  ProcedureStep,
} from '../../types'

interface CreationRequest {
  player: PlayerId
  step: ProcedureStep
}

interface UnitCreationModalProps {
  request: CreationRequest | null
  players: Record<PlayerId, PlayerState>
  selection: { base?: BaseType; role?: ClassType }
  onSelectBase: (base: BaseType) => void
  onSelectRole: (role: ClassType) => void
  onConfirm: () => void
  onCancel: () => void
}

export const UnitCreationModal = ({
  request,
  players,
  selection,
  onSelectBase,
  onSelectRole,
  onConfirm,
  onCancel,
}: UnitCreationModalProps) => (
  <Modal
    title="ユニット作成"
    isOpen={Boolean(request)}
    onClose={onCancel}
    footer={
      request ? (
        <div className="modal-actions">
          <button disabled={!selection.base || !selection.role} onClick={onConfirm}>
            作成する
          </button>
          <button className="ghost" onClick={onCancel}>
            キャンセル
          </button>
        </div>
      ) : null
    }
  >
    {request ? (
      <div>
        <p>{players[request.player].name}のベースと兵種を選択してください。</p>
        <div className="card-picker">
          {(Object.keys(baseDisplayNames) as BaseType[]).map((base) => (
            <button
              key={base}
              disabled={players[request.player].baseCards[base] <= 0}
              className={selection.base === base ? 'selected' : ''}
              onClick={() => onSelectBase(base)}
            >
              {baseDisplayNames[base]} ({players[request.player].baseCards[base]})
            </button>
          ))}
        </div>
        <div className="card-picker">
          {(Object.keys(classDisplayNames) as ClassType[]).map((role) => (
            <button
              key={role}
              disabled={players[request.player].classCards[role] <= 0}
              className={selection.role === role ? 'selected' : ''}
              onClick={() => onSelectRole(role)}
            >
              {classDisplayNames[role]} ({players[request.player].classCards[role]})
            </button>
          ))}
        </div>
      </div>
    ) : null}
  </Modal>
)
