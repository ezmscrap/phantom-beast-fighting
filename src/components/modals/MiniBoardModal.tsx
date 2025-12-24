import { Modal } from '../Modal'
import { baseDisplayNames, classDisplayNames, columns, rows } from '../../constants'
import type { BoardCell, MiniBoardState, PlacementState, Unit } from '../../types'
import { playAudio } from '../../audio'

interface MiniBoardModalProps {
  miniBoardState: MiniBoardState | null
  placementState: PlacementState | null
  boardMap: Map<BoardCell, Unit>
  currentPlacementTargets: BoardCell[]
  onCellClick: (cell: BoardCell) => void
  onCancel: () => void
}

export const MiniBoardModal = ({
  miniBoardState,
  placementState,
  boardMap,
  currentPlacementTargets,
  onCellClick,
  onCancel,
}: MiniBoardModalProps) => (
  <Modal
    title={miniBoardState?.mode === 'swap' ? 'ユニット入れ替え' : '配置マス選択'}
    isOpen={Boolean(miniBoardState)}
    onClose={onCancel}
    footer={
      <div className="modal-actions">
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
    {miniBoardState && placementState ? (
      <div>
        <p>
          {miniBoardState.mode === 'swap'
            ? '入れ替える自分のユニットを2体選択してください。'
            : 'ミニ配置面から配置場所を選択してください。'}
        </p>
        <div className="mini-board">
          {rows.map((row) => (
            <div key={row} className="mini-row">
              {columns.map((column) => {
                const cell = `${column}${row}` as BoardCell
                const occupant = boardMap.get(cell)
                const ownsUnit = Boolean(occupant && occupant.owner === miniBoardState.player)
                const selectable =
                  miniBoardState.mode === 'placement'
                    ? currentPlacementTargets.includes(cell)
                    : Boolean(ownsUnit && occupant?.status === 'tentative')
                const disabled =
                  miniBoardState.mode === 'placement' ? !selectable : !ownsUnit
                const swapChosen =
                  miniBoardState.mode === 'swap' && occupant
                    ? placementState.swapSelection.includes(occupant.id)
                    : false
                return (
                  <button
                    key={cell}
                    className={`mini-cell ${
                      selectable ? (miniBoardState.mode === 'swap' ? 'swap-selectable' : 'highlight') : ''
                    } ${swapChosen ? 'swap-selected' : ''}`}
                    disabled={disabled}
                    onClick={() => {
                      playAudio('button')
                      onCellClick(cell)
                    }}
                  >
                    {occupant ? (
                      <span className={`mini-piece mini-piece--${occupant.owner}`}>
                        {baseDisplayNames[occupant.base][0]}
                        <small>{classDisplayNames[occupant.role][0]}</small>
                      </span>
                    ) : (
                      <span className="mini-cell__label">{column + row}</span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    ) : null}
  </Modal>
)
