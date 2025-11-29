import * as THREE from 'three'
import {
  Body,
  Box,
  ContactMaterial,
  Material,
  Quaternion as CannonQuaternion,
  Vec3,
  World,
} from 'cannon-es'
import type { DebugDiceSettings, DiceType } from '../types'
import { appConfig } from '../config'
import type { BeastLabel } from '../diceFaces'
import { GOLD_D6_LABELS, SILVER_D6_LABELS, mapGoldD6, mapSilverD6 } from '../diceFaces'

const UP_VECTOR = new Vec3(0, 1, 0)

const FACE_NORMALS: Record<number, Vec3> = {
  1: new Vec3(0, 1, 0),
  2: new Vec3(1, 0, 0),
  3: new Vec3(0, 0, 1),
  4: new Vec3(0, 0, -1),
  5: new Vec3(-1, 0, 0),
  6: new Vec3(0, -1, 0),
}

const labelMap: Record<DiceType, (value: number) => BeastLabel> = {
  silver: mapSilverD6,
  gold: mapGoldD6,
}

const FACE_VALUE_ORDER = [2, 5, 1, 6, 3, 4]
const FACE_BG_COLOR: Record<DiceType, string> = {
  silver: '#f1f7ff',
  gold: '#fbe7b5',
}
const FACE_TEXT_COLOR: Record<DiceType, string> = {
  silver: '#142035',
  gold: '#462200',
}
const FACE_BORDER_COLOR = '#101010'
const STAGE_HALF_WIDTH = 4.8
const STAGE_HALF_DEPTH = 4.8
const STAGE_WALL_HEIGHT = 7
const STAGE_WALL_THICKNESS = 0.35
const STAGE_CEILING_HEIGHT = 11
const STAGE_MARGIN = 0.6

const DEFAULT_SETTINGS: DebugDiceSettings = appConfig.diceDebug

const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min

/** 物理計算用サイコロ生成指示 */
export interface DiceRollPlan {
  id: string
  type: DiceType
  targetValue?: number
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

interface ParsedGroup {
  type: DiceType
  count: number
}

/** `2d6_silver+1d6_gold@1,4,3` のような表記をステップごとに解析する */
export const parseNotation = (
  notation: string,
): { groups: ParsedGroup[]; predetermined: number[] } => {
  if (!notation) return { groups: [], predetermined: [] }
  const [groupPart, predeterminedPart] = notation.split('@')
  const groups: ParsedGroup[] = []
  groupPart
    .split('+')
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((chunk) => {
      const match = chunk.match(/^(\d+)d6(?:_(silver|gold))?$/i)
      if (!match) {
        throw new Error(`Unsupported dice notation: ${chunk}`)
      }
      const [, countText, typeText] = match
      const count = Number(countText)
      const type = (typeText?.toLowerCase() ?? 'silver') as DiceType
      groups.push({ type, count })
    })
  const predetermined = predeterminedPart
    ? predeterminedPart
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value) && value > 0)
    : []
  return { groups, predetermined }
}

/** サイコロ配列から `2d6_silver+1d6_gold@1,4,3` 形式の表記を組み立てる */
export const buildNotation = (plan: DiceRollPlan[]): string => {
  if (!plan.length) return ''
  const counts: Record<DiceType, number> = { silver: 0, gold: 0 }
  plan.forEach((entry) => {
    counts[entry.type] += 1
  })
  const groups = (Object.keys(counts) as DiceType[])
    .filter((type) => counts[type] > 0)
    .map((type) => `${counts[type]}d6_${type}`)
  const predetermined = plan.every((entry) => typeof entry.targetValue === 'number')
    ? plan.map((entry) => entry.targetValue).join(',')
    : ''
  return predetermined ? `${groups.join('+')}@${predetermined}` : groups.join('+')
}

/** 表記を解析し、DiceEngine.roll に渡せるプラン配列を生成する */
export const planFromNotation = (notation: string): DiceRollPlan[] => {
  const { groups, predetermined } = parseNotation(notation)
  const plan: DiceRollPlan[] = []
  let index = 0
  groups.forEach(({ type, count }) => {
    Array.from({ length: count }).forEach(() => {
      const targetValue = predetermined[index]
      plan.push({
        id: `die-${index}`,
        type,
        targetValue: Number.isFinite(targetValue) ? targetValue : undefined,
      })
      index += 1
    })
  })
  return plan
}

/** DiceEngine インスタンスと表記を受け取り、1ステップで投擲するユーティリティ */
export const rollDice = (engine: DiceEngine, notation: string, options?: RollOptions) => {
  const plan = planFromNotation(notation)
  return engine.roll(plan, { ...options, notation })
}

const toCannonQuaternion = (quaternion: THREE.Quaternion) =>
  new CannonQuaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w)

const quaternionForValue = (value: number) => {
  const base = FACE_NORMALS[value]
  if (!base) return new CannonQuaternion()
  const from = new THREE.Vector3(base.x, base.y, base.z).normalize()
  const to = new THREE.Vector3(0, 1, 0)
  const alignment = new THREE.Quaternion().setFromUnitVectors(from, to)
  const yaw = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    randomInRange(0, Math.PI * 2),
  )
  return toCannonQuaternion(yaw.multiply(alignment))
}

const determineFaceValue = (quaternion: CannonQuaternion): number => {
  let bestValue = 1
  let bestDot = -Infinity
  for (const [valueText, normal] of Object.entries(FACE_NORMALS)) {
    const worldNormal = quaternion.vmult(normal)
    const dot = worldNormal.dot(UP_VECTOR)
    if (dot > bestDot) {
      bestDot = dot
      bestValue = Number(valueText)
    }
  }
  return bestValue
}

const createDieGeometry = (size: number) => new THREE.BoxGeometry(size, size, size)

type FaceMode = 'numeric' | 'label'

const LABEL_SETS: Record<DiceType, readonly BeastLabel[]> = {
  silver: SILVER_D6_LABELS,
  gold: GOLD_D6_LABELS,
}

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

const createDieMaterials = (type: DiceType, mode: FaceMode) =>
  FACE_VALUE_ORDER.map((value) => {
    const texture = createFaceTexture(type, value, mode)
    return new THREE.MeshStandardMaterial({
      map: texture,
      metalness: 0.2,
      roughness: 0.4,
    })
  })

const cloneDebugSettings = (settings: DebugDiceSettings) => JSON.parse(JSON.stringify(settings))

/**
 * Three.js + Cannon-es を組み合わせた 3D ダイスエンジン。
 * DiceBox の API を参考に、`initialize` -> `roll` の順で使用する。
 */
export class DiceEngine {
  private container: HTMLElement
  private scene: THREE.Scene | null = null
  private camera: THREE.PerspectiveCamera | null = null
  private renderer: THREE.WebGLRenderer | null = null
  private world: World | null = null
  private diceMaterial: Material | null = null
  private floorMaterial: Material | null = null
  private wallMaterial: Material | null = null
  private floorContact: ContactMaterial | null = null
  private wallContact: ContactMaterial | null = null
  private dice: DiceInstance[] = []
  private dieGeometry: THREE.BoxGeometry | null = null
  private dieGeometrySize = 0
  private dieMaterials: Partial<Record<DiceType, THREE.MeshStandardMaterial[]>> = {}
  private materialMode: FaceMode | null = null
  private animationFrame: number | null = null
  private pendingResolve: ((result: RollResult) => void) | null = null
  private pendingReject: ((reason?: unknown) => void) | null = null
  private resizeObserver: ResizeObserver | null = null
  private settings: DebugDiceSettings

  constructor(container: HTMLElement, baseSettings?: DebugDiceSettings) {
    this.container = container
    this.settings = cloneDebugSettings(baseSettings ?? DEFAULT_SETTINGS)
  }

  /** 初期化: DOM, レンダラ, 物理ワールドをセットアップする */
  async initialize() {
    if (this.scene) return
    const scene = new THREE.Scene()
    scene.background = null
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000)
    camera.position.set(0, 18, 0)
    camera.lookAt(new THREE.Vector3(0, 0, 0))
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setClearColor(0x000000, 0)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.container.appendChild(renderer.domElement)
    const ambient = new THREE.AmbientLight(0xffffff, 0.5)
    const directional = new THREE.DirectionalLight(0xffffff, 0.9)
    directional.position.set(-6, 15, 10)
    directional.castShadow = true
    directional.shadow.mapSize.set(1024, 1024)
    scene.add(ambient)
    scene.add(directional)
    const world = new World({ gravity: new Vec3(0, -9.82, 0) })
    world.allowSleep = true
    ;(world.solver as { iterations?: number }).iterations = 40
    this.diceMaterial = new Material('dice')
    this.floorMaterial = new Material('floor')
    this.wallMaterial = new Material('wall')
    this.applyContactMaterials(world, this.settings)
    this.buildStage(scene, world)
    this.scene = scene
    this.camera = camera
    this.renderer = renderer
    this.world = world
    this.refreshViewport()
    this.resizeObserver = new ResizeObserver(() => this.refreshViewport())
    this.resizeObserver.observe(this.container)
    window.addEventListener('resize', this.refreshViewport)
  }

  /** 新しい設定値を記録。次の roll 時に利用される。 */
  setSettings(settings: DebugDiceSettings) {
    this.settings = cloneDebugSettings(settings)
    if (this.world) {
      this.applyContactMaterials(this.world, this.settings)
    }
  }

  /** サイコロを投げる。完了すると結果 JSON を返す。 */
  async roll(plan: DiceRollPlan[], options?: RollOptions): Promise<RollResult> {
    if (!this.scene || !this.world || !this.camera || !this.renderer) {
      await this.initialize()
    }
    if (!this.scene || !this.world || !this.camera || !this.renderer) {
      throw new Error('DiceEngine failed to initialize')
    }
    if (!plan.length) {
      return { dice: [], notation: '' }
    }
    this.cancelRoll()
    const settings = options?.debugSettings ?? this.settings
    this.setSettings(settings)
    this.spawnDice(plan, settings)
    const notation = options?.notation ?? buildNotation(plan)
    return new Promise<RollResult>((resolve, reject) => {
      this.pendingResolve = resolve
      this.pendingReject = reject
      this.startLoop(notation)
    })
  }

  /** 進行中のロールを中断し、サイコロを消す */
  cancelRoll() {
    if (this.animationFrame != null) {
      cancelAnimationFrame(this.animationFrame)
      this.animationFrame = null
    }
    this.dice.forEach((die) => {
      this.scene?.remove(die.mesh)
      if (this.world && die.body) {
        this.world.removeBody(die.body)
      }
    })
    this.dice = []
    if (this.pendingReject) {
      this.pendingReject(new Error('Roll cancelled'))
    }
    this.pendingResolve = null
    this.pendingReject = null
  }

  /** 完全破棄: DOM ノードやイベントを片付ける */
  dispose() {
    this.cancelRoll()
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    window.removeEventListener('resize', this.refreshViewport)
    if (this.renderer) {
      this.container.removeChild(this.renderer.domElement)
      this.renderer.dispose()
      this.renderer = null
    }
    this.dieGeometry?.dispose()
    this.dieGeometry = null
    this.dieGeometrySize = 0
    this.disposeMaterials()
    this.scene = null
    this.camera = null
    this.world = null
  }

  private refreshViewport = () => {
    if (!this.renderer || !this.camera) return
    const { clientWidth, clientHeight } = this.container
    if (clientWidth === 0 || clientHeight === 0) return
    this.renderer.setSize(clientWidth, clientHeight, false)
    this.camera.aspect = clientWidth / clientHeight
    this.camera.updateProjectionMatrix()
  }

  private applyContactMaterials(world: World, settings: DebugDiceSettings) {
    if (!this.diceMaterial || !this.floorMaterial || !this.wallMaterial) return
    if (this.floorContact) {
      this.floorContact.friction = settings.contact.floorFriction
      this.floorContact.restitution = settings.contact.floorRestitution
    } else {
      this.floorContact = new ContactMaterial(this.diceMaterial, this.floorMaterial, {
        friction: settings.contact.floorFriction,
        restitution: settings.contact.floorRestitution,
      })
      world.addContactMaterial(this.floorContact)
    }
    if (this.wallContact) {
      this.wallContact.friction = settings.contact.wallFriction
      this.wallContact.restitution = settings.contact.wallRestitution
    } else {
      this.wallContact = new ContactMaterial(this.diceMaterial, this.wallMaterial, {
        friction: settings.contact.wallFriction,
        restitution: settings.contact.wallRestitution,
      })
      world.addContactMaterial(this.wallContact)
    }
  }

  private buildStage(scene: THREE.Scene, world: World) {
    const floorGeometry = new THREE.PlaneGeometry(30, 30)
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x0a1e0f, roughness: 0.8 })
    const floor = new THREE.Mesh(floorGeometry, floorMaterial)
    floor.receiveShadow = true
    floor.rotation.x = -Math.PI / 2
    floor.visible = false
    scene.add(floor)
    const floorBody = new Body({
      mass: 0,
      material: this.floorMaterial ?? undefined,
      shape: new Box(new Vec3(STAGE_HALF_WIDTH, 0.5, STAGE_HALF_DEPTH)),
    })
    floorBody.position.set(0, -0.5, 0)
    world.addBody(floorBody)
    const wallShapeX = new Box(
      new Vec3(STAGE_WALL_THICKNESS, STAGE_WALL_HEIGHT, STAGE_HALF_DEPTH),
    )
    const wallShapeZ = new Box(
      new Vec3(STAGE_HALF_WIDTH, STAGE_WALL_HEIGHT, STAGE_WALL_THICKNESS),
    )
    const walls: Array<{ shape: Box; position: [number, number, number] }> = [
      { shape: wallShapeX, position: [STAGE_HALF_WIDTH + STAGE_WALL_THICKNESS, STAGE_WALL_HEIGHT, 0] },
      { shape: wallShapeX, position: [-STAGE_HALF_WIDTH - STAGE_WALL_THICKNESS, STAGE_WALL_HEIGHT, 0] },
      { shape: wallShapeZ, position: [0, STAGE_WALL_HEIGHT, STAGE_HALF_DEPTH + STAGE_WALL_THICKNESS] },
      { shape: wallShapeZ, position: [0, STAGE_WALL_HEIGHT, -STAGE_HALF_DEPTH - STAGE_WALL_THICKNESS] },
    ]
    walls.forEach(({ shape, position }) => {
      const wall = new Body({
        mass: 0,
        material: this.wallMaterial ?? undefined,
        shape,
      })
      wall.position.set(...position)
      world.addBody(wall)
    })
    const ceiling = new Body({
      mass: 0,
      material: this.wallMaterial ?? undefined,
      shape: new Box(new Vec3(STAGE_HALF_WIDTH, 0.5, STAGE_HALF_DEPTH)),
    })
    ceiling.position.set(0, STAGE_CEILING_HEIGHT + 0.5, 0)
    world.addBody(ceiling)
  }

  private spawnDice(plan: DiceRollPlan[], settings: DebugDiceSettings) {
    const world = this.world
    const scene = this.scene
    if (!world || !scene) return
    this.dice = []
    const geometry = this.ensureGeometry(settings)
    const materials = this.ensureMaterials()
    const count = plan.length
    plan.forEach((entry, index) => {
      const body = new Body({
        mass: settings.body.mass,
        shape: new Box(new Vec3(settings.dieSize / 2, settings.dieSize / 2, settings.dieSize / 2)),
        material: this.diceMaterial ?? undefined,
        linearDamping: settings.body.linearDamping,
        angularDamping: settings.body.angularDamping,
      })
      const mesh = new THREE.Mesh(geometry, materials[entry.type])
      mesh.castShadow = true
      mesh.receiveShadow = true
      scene.add(mesh)
      world.addBody(body)
      this.positionAndLaunchDie(body, index, count, entry.targetValue, settings)
      this.dice.push({ plan: entry, body, mesh, settledFrames: 0 })
    })
  }

  private ensureGeometry(settings: DebugDiceSettings): THREE.BoxGeometry {
    if (!this.dieGeometry || this.dieGeometrySize !== settings.dieSize) {
      this.dieGeometry?.dispose()
      this.dieGeometry = createDieGeometry(settings.dieSize)
      this.dieGeometrySize = settings.dieSize
    }
    return this.dieGeometry!
  }

  private ensureMaterials(): Record<DiceType, THREE.MeshStandardMaterial[]> {
    const mode: FaceMode = this.settings.numericMode ? 'numeric' : 'label'
    if (this.materialMode !== mode) {
      this.disposeMaterials()
      this.dieMaterials = {}
      this.materialMode = mode
    }
    const types: DiceType[] = ['silver', 'gold']
    types.forEach((type) => {
      if (!this.dieMaterials[type]) {
        this.dieMaterials[type] = createDieMaterials(type, mode)
      }
    })
    return this.dieMaterials as Record<DiceType, THREE.MeshStandardMaterial[]>
  }

  private disposeMaterials() {
    ;(Object.values(this.dieMaterials) as THREE.MeshStandardMaterial[][]).forEach((materials) => {
      materials.forEach((material) => {
        material.map?.dispose()
        material.dispose()
      })
    })
    this.materialMode = null
  }

  private positionAndLaunchDie(
    body: Body,
    index: number,
    total: number,
    targetValue: number | undefined,
    settings: DebugDiceSettings,
  ) {
    const spread = settings.launchSpread
    const offset = (index - (total - 1) / 2) * spread
    const clamp = (value: number, halfSize: number) =>
      Math.max(-halfSize + STAGE_MARGIN, Math.min(halfSize - STAGE_MARGIN, value))
    const x = clamp(settings.launchOrigin.x + offset + randomInRange(-0.3, 0.3), STAGE_HALF_WIDTH)
    const y = Math.min(settings.spawnHeight + randomInRange(0, 1), STAGE_CEILING_HEIGHT - STAGE_MARGIN)
    const z = clamp(settings.launchOrigin.z + randomInRange(-spread, spread), STAGE_HALF_DEPTH)
    body.position.set(x, y, z)
    if (targetValue) {
      body.quaternion.copy(quaternionForValue(targetValue))
    } else {
      body.quaternion.copy(quaternionForValue(Math.ceil(Math.random() * 6)))
    }
    const direction = new Vec3(settings.launchVector.x, 0, settings.launchVector.z)
    if (direction.lengthSquared() === 0) {
      direction.set(1, 0, 0)
    }
    direction.normalize()
    const horizontalBase = Math.max(settings.impulse.minHorizontal * 0.01, 4)
    const vx = direction.x * horizontalBase + randomInRange(-settings.impulse.x * 0.02, settings.impulse.x * 0.02)
    const vz = direction.z * horizontalBase + randomInRange(-settings.impulse.z * 0.02, settings.impulse.z * 0.02)
    const vy = settings.impulse.y * 0.1 + randomInRange(0, settings.impulse.y * 0.05)
    body.velocity.set(vx, vy, vz)
    const torqueScale = Math.max(settings.impulse.torque * 0.02, 0.5)
    body.angularVelocity.set(
      randomInRange(-torqueScale, torqueScale),
      randomInRange(-torqueScale, torqueScale),
      randomInRange(-torqueScale, torqueScale),
    )
  }

  private startLoop(notation: string) {
    const step = () => {
      if (!this.world || !this.scene || !this.camera || !this.renderer) return
      this.world.step(1 / 60)
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
      this.renderer.render(this.scene, this.camera)
      if (this.dice.every((die) => die.settledFrames > 30)) {
        this.finishRoll(notation)
        return
      }
      this.animationFrame = requestAnimationFrame(step)
    }
    this.animationFrame = requestAnimationFrame(step)
  }

  private finishRoll(notation: string) {
    if (!this.pendingResolve) return
    const diceResults: RollResultEntry[] = this.dice.map((die) => {
      const value = determineFaceValue(die.body.quaternion)
      const mapper = labelMap[die.plan.type]
      return {
        id: die.plan.id,
        type: die.plan.type,
        value,
        label: mapper(value),
      }
    })
    this.pendingResolve({ dice: diceResults, notation })
    this.pendingResolve = null
    this.pendingReject = null
    this.animationFrame = null
  }
}
