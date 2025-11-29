import * as THREE from 'three'
import type { Body } from 'cannon-es'
import type { DebugDiceSettings, DiceType } from '../../types'
import type { BeastLabel } from '../../diceFaces'
import { mapGoldD6, mapSilverD6 } from '../../diceFaces'
import { appConfig } from '../../config'
import { DicePhysicsStage, applyContactSettings, buildPhysicsWorld, createDiceBody, type DicePhysicsWorld } from './physics'
import { createDiceMaterials } from './textures'
import { determineFaceValue } from './orientation'
import { buildNotation, planFromNotation, type DiceRollPlan } from './notation'
import type { FaceMode } from './types'

const DEFAULT_SETTINGS: DebugDiceSettings = appConfig.diceDebug
const labelMap: Record<DiceType, (value: number) => BeastLabel> = {
  silver: mapSilverD6,
  gold: mapGoldD6,
}

export interface RollResultEntry {
  id: string
  type: DiceType
  value: number
  label: BeastLabel
}

export interface RollResult {
  dice: RollResultEntry[]
  notation: string
}

export interface RollOptions {
  notation?: string
  debugSettings?: DebugDiceSettings
}

interface DiceInstance {
  plan: DiceRollPlan
  body: Body
  mesh: THREE.Mesh
  settledFrames: number
}

export class DiceEngine {
  private container: HTMLElement
  private stage: DicePhysicsStage | null = null
  private physics: DicePhysicsWorld | null = null
  private dice: DiceInstance[] = []
  private geometry: THREE.BoxGeometry | null = null
  private geometrySize = 0
  private materials: ReturnType<typeof createDiceMaterials> | null = null
  private animationId: number | null = null
  private resizeObserver: ResizeObserver | null = null
  private settings: DebugDiceSettings
  private pendingResolve: ((result: RollResult) => void) | null = null
  private pendingReject: ((reason?: unknown) => void) | null = null

  constructor(container: HTMLElement, settings?: DebugDiceSettings) {
    this.container = container
    this.settings = settings ?? DEFAULT_SETTINGS
  }

  async initialize() {
    if (this.stage) return
    this.stage = new DicePhysicsStage(this.container)
    this.physics = buildPhysicsWorld(this.settings)
    this.resizeObserver = new ResizeObserver(() => this.stage?.refreshViewport())
    this.resizeObserver.observe(this.container)
    window.addEventListener('resize', this.stage.refreshViewport)
  }

  setSettings(settings: DebugDiceSettings) {
    this.settings = settings
    if (this.physics) {
      applyContactSettings(this.physics, settings)
    }
  }

  async roll(plan: DiceRollPlan[], options?: RollOptions): Promise<RollResult> {
    if (!this.stage || !this.physics) {
      await this.initialize()
    }
    if (!this.stage || !this.physics) {
      throw new Error('Dice engine failed to initialize')
    }
    if (!plan.length) {
      return { dice: [], notation: options?.notation ?? '' }
    }
    this.cancelRoll()
    this.spawnDice(plan)
    const notation = options?.notation ?? buildNotation(plan)
    return new Promise<RollResult>((resolve, reject) => {
      this.pendingResolve = resolve
      this.pendingReject = reject
      this.startLoop(notation)
    })
  }

  cancelRoll() {
    if (this.animationId != null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
    this.dice.forEach((die) => {
      this.stage?.scene.remove(die.mesh)
      this.physics?.world.removeBody(die.body)
    })
    this.dice = []
    if (this.pendingReject) {
      this.pendingReject(new Error('Roll cancelled'))
    }
    this.pendingResolve = null
    this.pendingReject = null
  }

  dispose() {
    this.cancelRoll()
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    const stage = this.stage
    if (stage) {
      window.removeEventListener('resize', stage.refreshViewport)
      stage.dispose()
      this.stage = null
    }
    this.physics = null
    this.geometry?.dispose()
    this.geometry = null
    this.geometrySize = 0
    this.materials?.dispose()
    this.materials = null
  }

  private spawnDice(plan: DiceRollPlan[]) {
    if (!this.stage || !this.physics) return
    const settings = this.settings
    if (!this.geometry || this.geometrySize !== settings.dieSize) {
      this.geometry?.dispose()
      this.geometry = new THREE.BoxGeometry(settings.dieSize, settings.dieSize, settings.dieSize)
      this.geometrySize = settings.dieSize
    }
    const faceMode: FaceMode = settings.numericMode ? 'numeric' : 'label'
    if (!this.materials || this.materials.mode !== faceMode) {
      this.materials?.dispose()
      this.materials = createDiceMaterials(faceMode)
    }
    this.dice = plan.map((entry, index) => {
      const body = createDiceBody({
        settings,
        world: this.physics!,
        targetValue: entry.targetValue,
        index,
        total: plan.length,
      })
      const mesh = new THREE.Mesh(this.geometry!, this.materials!.getMaterial(entry.type))
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.stage!.scene.add(mesh)
      return { plan: entry, body, mesh, settledFrames: 0 }
    })
  }

  private startLoop(notation: string) {
    const step = () => {
      if (!this.physics || !this.stage) return
      this.physics.world.step(1 / 60)
      this.dice.forEach((die) => {
        die.mesh.position.set(die.body.position.x, die.body.position.y, die.body.position.z)
        die.mesh.quaternion.set(
          die.body.quaternion.x,
          die.body.quaternion.y,
          die.body.quaternion.z,
          die.body.quaternion.w,
        )
        const isSleeping =
          die.body.velocity.lengthSquared() < 0.01 && die.body.angularVelocity.lengthSquared() < 0.01
        die.settledFrames = isSleeping ? die.settledFrames + 1 : 0
      })
      this.stage.renderer.render(this.stage.scene, this.stage.camera)
      if (this.dice.every((die) => die.settledFrames > 30)) {
        this.finishRoll(notation)
        return
      }
      this.animationId = requestAnimationFrame(step)
    }
    this.animationId = requestAnimationFrame(step)
  }

  private finishRoll(notation: string) {
    if (!this.pendingResolve) return
    const diceResults: RollResultEntry[] = this.dice.map((die) => {
      const value = determineFaceValue(die.body.quaternion)
      return { id: die.plan.id, type: die.plan.type, value, label: labelMap[die.plan.type](value) }
    })
    this.pendingResolve({ dice: diceResults, notation })
    this.pendingResolve = null
    this.pendingReject = null
    this.animationId = null
  }
}

export type { DiceRollPlan }

export const rollDice = (engine: DiceEngine, notation: string, options?: RollOptions) => {
  const plan = planFromNotation(notation)
  return engine.roll(plan, { ...options, notation })
}
