import * as THREE from 'three'
import type { DiceType } from '../../types'
import { FACE_BG_COLOR, FACE_BORDER_COLOR, FACE_TEXT_COLOR, FACE_VALUE_ORDER, LABEL_SETS } from './constants'
import type { FaceMode } from './types'

const createFaceTexture = (type: DiceType, value: number, mode: FaceMode) => {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas 2D context is unavailable')
  }
  ctx.fillStyle = FACE_BG_COLOR[type]
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = FACE_BORDER_COLOR
  ctx.lineWidth = 16
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20)
  const glyph = mode === 'numeric' ? String(value) : LABEL_SETS[type][value - 1]
  ctx.font = mode === 'numeric' ? 'bold 260px "Noto Sans JP", "Roboto", sans-serif' : 'bold 240px "Noto Sans JP", "Roboto", sans-serif'
  ctx.fillStyle = FACE_TEXT_COLOR[type]
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(glyph, canvas.width / 2, canvas.height / 2 + 10)
  const texture = new THREE.CanvasTexture(canvas)
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}

export class DiceMaterialSet {
  private materials: Record<DiceType, THREE.MeshStandardMaterial[]>
  readonly mode: FaceMode

  constructor(mode: FaceMode) {
    this.mode = mode
    const types: DiceType[] = ['silver', 'gold']
    this.materials = types.reduce((acc, type) => {
      acc[type] = FACE_VALUE_ORDER.map((value) => {
        const texture = createFaceTexture(type, value, mode)
        return new THREE.MeshStandardMaterial({ map: texture, metalness: 0.2, roughness: 0.4 })
      })
      return acc
    }, {} as Record<DiceType, THREE.MeshStandardMaterial[]>)
  }

  getMaterial(type: DiceType) {
    return this.materials[type]
  }

  dispose() {
    Object.values(this.materials).forEach((materials) => {
      materials.forEach((material) => {
        material.map?.dispose()
        material.dispose()
      })
    })
  }
}

export const createDiceMaterials = (mode: FaceMode) => new DiceMaterialSet(mode)

export { createFaceTexture }
