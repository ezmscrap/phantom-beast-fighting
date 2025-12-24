import { columns, rows, baseDisplayNames, classDisplayNames } from '../../constants'
import type {
  BoardCell,
  MovementState,
  PlacementState,
  Unit,
} from '../../types'

interface GameBoardProps {
  boardMap: Map<BoardCell, Unit>
  movementState: MovementState | null
  placementState: PlacementState | null
  onSwapSelection: (unitId: string) => void
  onSelectUnitForMovement: (unit: Unit) => void
  onMoveUnit: (cell: BoardCell) => void
  interactionLocked?: boolean
}

const renderPiece = (unit: Unit | undefined) => {
  if (!unit) return null
  return (
    <div className={`piece piece--${unit.owner}`}>
      <span>{baseDisplayNames[unit.base][0]}</span>
      <small>{classDisplayNames[unit.role][0]}</small>
    </div>
  )
}

export const GameBoard = ({
  boardMap,
  movementState,
  placementState,
  onSwapSelection,
  onSelectUnitForMovement,
  onMoveUnit,
  interactionLocked = false,
}: GameBoardProps) => {
  return (
    <div className="board-grid">
      {rows.map((row) => (
        <div key={row} className="board-row">
          {columns.map((column) => {
            const cell = `${column}${row}` as BoardCell
            const occupant = boardMap.get(cell)
            const highlight =
              Boolean(movementState && movementState.selectedUnitId && movementState.destinations.includes(cell))
            const swapEligibleOwner =
              Boolean(placementState?.swapMode) && occupant && occupant.owner === placementState?.player
            const swapSelectable = swapEligibleOwner && occupant?.status === 'tentative'
            const swapSelected =
              swapSelectable &&
              placementState?.swapSelection.includes(occupant?.id ?? '')

            const handleCellClick = () => {
              if (interactionLocked) return
              if (placementState?.swapMode) {
                if (swapEligibleOwner && occupant) {
                  onSwapSelection(occupant.id)
                }
                return
              }
              if (!movementState) return
              if (movementState.selectedUnitId && movementState.destinations.includes(cell)) {
                onMoveUnit(cell)
                return
              }
              if (
                !movementState.selectedUnitId &&
                occupant &&
                occupant.owner === movementState.player &&
                movementState.budget[occupant.role] > 0
              ) {
                onSelectUnitForMovement(occupant)
              }
            }

            return (
              <button
                key={cell}
                className={`board-cell ${highlight ? 'highlight' : ''} ${swapSelectable ? 'swap-selectable' : ''} ${swapSelected ? 'swap-selected' : ''}`}
                onClick={handleCellClick}
              >
                {renderPiece(occupant)}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
