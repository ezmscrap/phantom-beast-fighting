import { columns, dragonOffsets, griffinOffsets, rows, unicornOffsets } from '../constants'
import type { BoardCell, Unit } from '../types'

const wrapIndex = (value: number, max: number) => ((value % max) + max) % max

const cellToCoords = (cell: BoardCell) => {
  const column = columns.indexOf(cell[0] as never)
  const row = rows.indexOf(Number(cell.slice(1)) as never)
  return { row, column }
}

const coordsToCell = (row: number, column: number): BoardCell | null => {
  if (row < 0 || row >= rows.length || column < 0 || column >= columns.length) {
    return null
  }
  return `${columns[column]}${rows[row]}` as BoardCell
}

export const buildBoardMap = (units: Unit[]) => {
  const map = new Map<BoardCell, Unit>()
  units.forEach((unit) => {
    if (unit.status === 'deployed' && unit.position) {
      map.set(unit.position, unit)
    }
  })
  return map
}

export const computeLegalMoves = (unit: Unit, board: Map<BoardCell, Unit>, wrap: boolean): BoardCell[] => {
  const { row, column } = unit.position ? cellToCoords(unit.position) : { row: -1, column: -1 }
  if (row === -1 || column === -1) return []
  const offsets =
    unit.base === 'dragon' ? dragonOffsets : unit.base === 'griffin' ? griffinOffsets : unicornOffsets
  const results: BoardCell[] = []
  const maxRow = rows.length
  const maxCol = columns.length

  const applyWrap = (r: number, c: number) => {
    const y = wrap ? wrapIndex(r, maxRow) : r
    const x = wrap ? wrapIndex(c, maxCol) : c
    if (!wrap && (y < 0 || y >= maxRow || x < 0 || x >= maxCol)) {
      return null
    }
    return coordsToCell(y, x)
  }

  offsets.forEach(([dy, dx]) => {
    const target = applyWrap(row + dy, column + dx)
    if (!target) return
    const occupant = board.get(target)

    if (!occupant) {
      results.push(target)
      return
    }

    if (unit.base === 'griffin') {
      if (occupant.owner !== unit.owner) {
        results.push(target)
      }
      const dirY = Math.sign(dy)
      const dirX = Math.sign(dx)
      const jumpCell = applyWrap(row + dy + dirY, column + dx + dirX)
      if (!jumpCell) return
      const jumpOccupant = board.get(jumpCell)
      if (!jumpOccupant || jumpOccupant.owner !== unit.owner) {
        results.push(jumpCell)
      }
      return
    }

    if (occupant.owner !== unit.owner) {
      results.push(target)
    }
  })

  return results
}
