import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { Physics, useBox, usePlane, useContactMaterial } from '@react-three/cannon'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { TextureLoader } from 'three'
import { GOLD_FACES, SILVER_FACES, diceFaceColors } from '../constants'
import type { ClassType, DiceType, MovementBudget, DebugDiceSettings } from '../types'
import { resolveAssetPath } from '../utils/assetPath'

export interface DiceVisual {
  id: string
  type: DiceType
  faceIndex?: number
  result?: ClassType
}

interface DiceRollerOverlayProps {
  dice: DiceVisual[]
  tallies: MovementBudget
  visible: boolean
  onClose: () => void
  rollSessionId: string
  onResolve: (dice: DiceVisual[], tallies: MovementBudget) => void
  debugSettings?: DebugDiceSettings
}

const FACE_DEFINITIONS: Record<DiceType, ClassType[]> = {
  silver: SILVER_FACES,
  gold: GOLD_FACES,
}

/**
 * 各ダイスの3Dモデルと物理挙動を管理するコンポーネント。
 * 位置/速度を監視し、一定時間静止したら出目を通知する。
 */
const DEFAULT_ROLL_SETTINGS: DebugDiceSettings = {
  dieSize: 0.5,
  spawnHeight: 6,
  impulse: {
    x: 24,
    y: 18,
    z: 24,
    torque: 40,
    minHorizontal: 600,
  },
  launchSpread: 1.1,
  numericMode: false,
  launchOrigin: {
    x: 2.8,
    z: -2.8,
  },
  launchVector: {
    x: -1500,
    z: 1500,
  },
  body: {
    mass: 0.35,
    linearDamping: 0.03,
    angularDamping: 0.02,
  },
  contact: {
    floorFriction: 0.08,
    floorRestitution: 0.75,
    wallFriction: 0.04,
    wallRestitution: 0.55,
  },
}

type RollSettings = DebugDiceSettings

const mergeRollSettings = (overrides?: DebugDiceSettings): RollSettings => ({
  dieSize: overrides?.dieSize ?? DEFAULT_ROLL_SETTINGS.dieSize,
  spawnHeight: overrides?.spawnHeight ?? DEFAULT_ROLL_SETTINGS.spawnHeight,
  impulse: {
    x: overrides?.impulse.x ?? DEFAULT_ROLL_SETTINGS.impulse.x,
    y: overrides?.impulse.y ?? DEFAULT_ROLL_SETTINGS.impulse.y,
    z: overrides?.impulse.z ?? DEFAULT_ROLL_SETTINGS.impulse.z,
    torque: overrides?.impulse.torque ?? DEFAULT_ROLL_SETTINGS.impulse.torque,
    minHorizontal: overrides?.impulse.minHorizontal ?? DEFAULT_ROLL_SETTINGS.impulse.minHorizontal,
  },
  launchSpread: overrides?.launchSpread ?? DEFAULT_ROLL_SETTINGS.launchSpread,
  numericMode: overrides?.numericMode ?? DEFAULT_ROLL_SETTINGS.numericMode,
  launchOrigin: {
    x: overrides?.launchOrigin.x ?? DEFAULT_ROLL_SETTINGS.launchOrigin.x,
    z: overrides?.launchOrigin.z ?? DEFAULT_ROLL_SETTINGS.launchOrigin.z,
  },
  launchVector: {
    x: overrides?.launchVector.x ?? DEFAULT_ROLL_SETTINGS.launchVector.x,
    z: overrides?.launchVector.z ?? DEFAULT_ROLL_SETTINGS.launchVector.z,
  },
  body: {
    mass: overrides?.body.mass ?? DEFAULT_ROLL_SETTINGS.body.mass,
    linearDamping: overrides?.body.linearDamping ?? DEFAULT_ROLL_SETTINGS.body.linearDamping,
    angularDamping: overrides?.body.angularDamping ?? DEFAULT_ROLL_SETTINGS.body.angularDamping,
  },
  contact: {
    floorFriction: overrides?.contact.floorFriction ?? DEFAULT_ROLL_SETTINGS.contact.floorFriction,
    floorRestitution:
      overrides?.contact.floorRestitution ?? DEFAULT_ROLL_SETTINGS.contact.floorRestitution,
    wallFriction: overrides?.contact.wallFriction ?? DEFAULT_ROLL_SETTINGS.contact.wallFriction,
    wallRestitution:
      overrides?.contact.wallRestitution ?? DEFAULT_ROLL_SETTINGS.contact.wallRestitution,
  },
})

const DiceMesh = ({
  type,
  settled,
  icons,
  material,
  onResult,
  registerShooter,
  settings,
  index,
  total,
  numericTextures,
}: {
  /** 銀/金などダイスの種類。出目テクスチャと効果音の判定に使う。 */
  type: DiceType
  /** 親コンポーネントから渡される「ダイスが完全に停止したかどうか」のフラグ。 */
  settled: boolean
  /** 各面に貼り付けるクラスアイコンのテクスチャ辞書。 */
  icons: Record<ClassType, THREE.Texture>
  /** cannon.js で使用する物理マテリアルの識別子。 */
  material: string
  /** 静止判定後に上面のインデックスとクラス種別を通知するコールバック。 */
  onResult: (faceIndex: number, result: ClassType) => void
  /** 親から投げ込み指示を受け取るための登録関数。 */
  registerShooter: (shoot: () => void) => void
  settings: RollSettings
  index: number
  total: number
  /** 数字面で使用するテクスチャ。 */
  numericTextures: THREE.Texture[]
}) => {
  /** 停止判定に使用するしきい値（速度） */
  const SPEED_THRESHOLD = 0.15
  /** 静止状態が続いたと見なすフレーム数。 */
  const STABLE_FRAME_THRESHOLD = 20
  /** 上面候補が同一で安定したか確認する追加フレーム数。 */
  const FACE_CONFIRMATION_FRAMES = 8
  /** ダイスモデルの一辺。設定から取得し、形状/座標計算に使用。 */
  const dieSize = settings.dieSize
  /** ダイスを落とす初期高さ。最低3以上に補正し、落下演出の安定性を確保。 */
  const spawnHeight = Math.max(settings.spawnHeight, 12)
  /** 同時投擲時の広がり補正。 */
  const spreadCenter = (total - 1) / 2
  const lateralIndex = index - spreadCenter
  const spreadDistance = settings.launchSpread * lateralIndex
  const direction = new THREE.Vector2(settings.launchVector.x, settings.launchVector.z)
  const perpendicular = direction.lengthSq()
    ? new THREE.Vector2(direction.y, -direction.x).normalize()
    : new THREE.Vector2(1, 0)
  const offsetX = perpendicular.x * spreadDistance
  const offsetZ = perpendicular.y * spreadDistance
  const clampWithinArena = (value: number) => Math.max(-5, Math.min(5, value))
  /** ダイスを投げ込む開始位置（壁の内部に収める）。 */
  const startX = clampWithinArena(settings.launchOrigin.x + offsetX)
  const startZ = clampWithinArena(settings.launchOrigin.z + offsetZ)
  /**
   * useBoxでcannonボディを生成。サイズ/質量/減衰などを設定し、
   * 乱数を使って初期姿勢をバラつかせる。
   */
  const [ref, api] = useBox<THREE.Group>(() => ({
    args: [dieSize, dieSize, dieSize],
    mass: settings.body.mass,
    linearDamping: settings.body.linearDamping,
    angularDamping: settings.body.angularDamping,
    position: [
      startX,
      1 + spawnHeight,
      startZ,
    ],
    rotation: [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI],
    material,
  }))

  /** 最新の平行移動速度を保持する参照。静止判定に使用。 */
  const velocity = useRef<[number, number, number]>([0, 0, 0])
  /** 最新の角速度を保持する参照。静止判定に使用。 */
  const angularVelocity = useRef<[number, number, number]>([0, 0, 0])
  /** 出目をすでに通知済みかどうかのフラグ。二重通知を防ぐ。 */
  const resolvedRef = useRef(false)
  /** 連続で静止判定を満たしたフレーム数を記録するカウンタ。 */
  const stillFrames = useRef(0)
  /** 一時的に検出した上面候補。一定時間同じ値なら確定する。 */
  const pendingResultRef = useRef<{ faceIndex: number; result: ClassType } | null>(null)
  /** pendingResultRef が継続したフレーム数。 */
  const pendingStableFramesRef = useRef(0)

  /** cannon API から速度ベクトルを購読し、参照へ格納。 */
  useEffect(() => {
    const unsubscribe = api.velocity.subscribe((v) => (velocity.current = v as [number, number, number]))
    return unsubscribe
  }, [api.velocity])
  /** cannon API から角速度を購読し、参照へ格納。 */
  useEffect(() => {
    const unsubscribe = api.angularVelocity.subscribe(
      (v) => (angularVelocity.current = v as [number, number, number]),
    )
    return unsubscribe
  }, [api.angularVelocity])

  /**
   * 親から受け取るshootコールバック。呼び出し時にインパルスを与える。
   */
  const shoot = useCallback(() => {
    if (!settled) {
      const verticalImpulse = settings.impulse.y
      const spreadBoost = 180
      let impulseX =
        settings.launchVector.x + settings.impulse.x + offsetX * spreadBoost
      let impulseZ =
        settings.launchVector.z + settings.impulse.z + offsetZ * spreadBoost
      const planar = Math.hypot(impulseX, impulseZ) || 1
      const minHorizontal = settings.impulse.minHorizontal
      if (planar < minHorizontal) {
        const scale = minHorizontal / planar
        impulseX *= scale
        impulseZ *= scale
      }
      api.applyImpulse([impulseX, verticalImpulse + 2.5, impulseZ], [0, 0, 0])
      api.velocity.set(impulseX * 0.4, verticalImpulse * 0.2, impulseZ * 0.4)
      const torqueScale = settings.impulse.torque
      const randomFactor = 0.5 + Math.random()
      api.applyTorque([
        impulseX * 0.3 * randomFactor,
        torqueScale * 0.2 * randomFactor,
        impulseZ * 0.3 * randomFactor,
      ])
    }
  }, [api, settled, settings, offsetX, offsetZ])

  useEffect(() => {
    registerShooter(shoot)
  }, [registerShooter, shoot])

  /**
   * 毎フレーム呼び出される監視ループ。
   * 1) 位置/回転の速度を計測し、定義済みしきい値以下の状態を計数する。
   * 2) 十分なフレーム静止していればワールド座標の上方向ベクトルを取得し、上面を算出。
   * 3) 面インデックスと兵種を求め、`onResult` に通知して1個のダイスを確定させる。
   */
  useFrame(() => {
    if (resolvedRef.current) return
    const linear = velocity.current
    const angular = angularVelocity.current
    /** 現在の平行移動速度の大きさ。停止判定の基本軸。 */
    const linearSpeed = Math.hypot(linear[0], linear[1], linear[2])
    /** 現在の角速度の大きさ。回転が止まっているかを測る。 */
    const angularSpeed = Math.hypot(angular[0], angular[1], angular[2])
    if (linearSpeed < SPEED_THRESHOLD && angularSpeed < SPEED_THRESHOLD) {
      stillFrames.current += 1
      if (stillFrames.current > STABLE_FRAME_THRESHOLD && ref.current) {
        /** 現在のボディ回転をワールド座標のクォータニオンとして取得。 */
        const quaternion = ref.current.getWorldQuaternion(new THREE.Quaternion())
        /** 上方向ベクトルをダイスの姿勢に合わせて回転させ、どちらの面が上を向いているか測る。 */
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion)
        /**
         * 各軸方向に対する上向き度合いを保持し、`value` が最大の面を上面と見なす。
         * index: ダイス面の添字、value: 上方向ベクトルとの一致度。
         */
        const axisContributions = [
          { index: 0, value: up.x },
          { index: 1, value: -up.x },
          { index: 2, value: up.y },
          { index: 3, value: -up.y },
          { index: 4, value: up.z },
          { index: 5, value: -up.z },
        ]
        /** value が最も大きい面を抽出し、上面を確定する。 */
        const topFace = axisContributions.reduce((prev, current) =>
          current.value > prev.value ? current : prev,
        )
        /** 出目配列 (銀/金) から上面の兵種を取得する。 */
        const faceDefinitions = type === 'silver' ? SILVER_FACES : GOLD_FACES
        const result = faceDefinitions[topFace.index]
        const pending = pendingResultRef.current
        if (!pending || pending.faceIndex !== topFace.index) {
          pendingResultRef.current = { faceIndex: topFace.index, result }
          pendingStableFramesRef.current = 1
        } else {
          pendingStableFramesRef.current += 1
          if (pendingStableFramesRef.current > FACE_CONFIRMATION_FRAMES) {
            resolvedRef.current = true
            onResult(topFace.index, result)
          }
        }
      }
    } else {
      stillFrames.current = 0
      pendingResultRef.current = null
      pendingStableFramesRef.current = 0
    }
  })

  /** ダイス本体の面カラー。種類ごとに色を変える。 */
  const color = diceFaceColors[type]
  return (
    <group ref={ref}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[dieSize, dieSize, dieSize]} />
        {[...Array(6)].map((_, index) => (
          <meshStandardMaterial key={index} color={color} />
        ))}
      </mesh>
      {FACE_DEFINITIONS[type].map((face, faceIndex) => {
        const offset = dieSize / 2 + 0.01
        const iconSize = dieSize * 0.7
        const transforms: Array<{ position: [number, number, number]; rotation: [number, number, number] }> = [
          { position: [offset, 0, 0], rotation: [0, Math.PI / 2, 0] },
          { position: [-offset, 0, 0], rotation: [0, -Math.PI / 2, 0] },
          { position: [0, offset, 0], rotation: [-Math.PI / 2, 0, 0] },
          { position: [0, -offset, 0], rotation: [Math.PI / 2, 0, 0] },
          { position: [0, 0, offset], rotation: [0, 0, 0] },
          { position: [0, 0, -offset], rotation: [0, Math.PI, 0] },
        ]
        const transform = transforms[faceIndex]
        if (settings.numericMode) {
          const numericTexture = numericTextures[faceIndex]
          return (
            <mesh
              key={`num-${faceIndex}`}
              position={transform.position}
              rotation={transform.rotation}
              renderOrder={2}
            >
              <planeGeometry args={[iconSize, iconSize]} />
              <meshBasicMaterial map={numericTexture} transparent opacity={0.95} color="#ffffff" />
            </mesh>
          )
        }
        return (
          <mesh
            key={`${face}-${faceIndex}`}
            position={transform.position}
            rotation={transform.rotation}
            renderOrder={1}
          >
            <planeGeometry args={[iconSize, iconSize]} />
            <meshBasicMaterial map={icons[face]} transparent opacity={0.95} color="#ffffff" />
          </mesh>
        )
      })}
    </group>
  )
}

/** ダイスが落下する床と四方の壁を生成する補助コンポーネント。 */
const FloorAndWalls = ({ materials }: { materials: { floor: string; wall: string } }) => {
  const [floorRef] = usePlane<THREE.Mesh>(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, 0, 0],
    type: 'Static',
    material: materials.floor,
  }))

  const createWall = (position: [number, number, number], rotation: [number, number, number]) => {
    const [wallRef] = useBox<THREE.Mesh>(() => ({
      args: [20, 24, 0.5],
      position,
      rotation,
      type: 'Static',
      material: materials.wall,
    }))
    return (
      <mesh key={`${position.join('-')}`} ref={wallRef} receiveShadow castShadow>
        <boxGeometry args={[20, 12, 0.5]} />
        <meshPhysicalMaterial color="#cfe2ff" opacity={0.2} transparent depthWrite={false} />
      </mesh>
    )
  }

  return (
    <>
      <mesh ref={floorRef} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshPhysicalMaterial color="#cfe2ff" opacity={0.2} transparent depthWrite={false} />
      </mesh>
      {createWall([0, 6, -5.5], [0, 0, 0])}
      {createWall([0, 6, 5.5], [0, 0, 0])}
      {createWall([-5.5, 6, 0], [0, Math.PI / 2, 0])}
      {createWall([5.5, 6, 0], [0, Math.PI / 2, 0])}
    </>
  )
}

const iconPaths: Record<ClassType, string> = {
  swordsman: resolveAssetPath('icons/swords.svg'),
  mage: resolveAssetPath('icons/wand.svg'),
  tactician: resolveAssetPath('icons/chess.svg'),
}

const createNumericFaceTextures = () => {
  const textures: THREE.Texture[] = []
  for (let i = 1; i <= 6; i += 1) {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, size, size)
      ctx.fillStyle = 'rgba(0,0,0,0)'
      ctx.fillRect(0, 0, size, size)
      ctx.fillStyle = '#ffffff'
      ctx.font = `bold ${size * 0.7}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(i), size / 2, size / 2)
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
    textures.push(texture)
  }
  return textures
}

const PhysicsMaterials = ({
  floor,
  wall,
  dice,
  contact,
}: {
  floor: { name: string }
  wall: { name: string }
  dice: { name: string }
  contact: RollSettings['contact']
}) => {
  useContactMaterial(floor.name, dice.name, {
    friction: contact.floorFriction,
    restitution: contact.floorRestitution,
  })
  useContactMaterial(wall.name, dice.name, {
    friction: contact.wallFriction,
    restitution: contact.wallRestitution,
  })
  return null
}

const CAMERA_SETTINGS = {
  position: [0, 28, 0] as [number, number, number],
  fov: 28,
}

export const DiceRollerOverlay = ({
  dice,
  visible,
  onClose,
  tallies,
  rollSessionId,
  onResolve,
  debugSettings,
}: DiceRollerOverlayProps) => {
  /** デバッグ設定または既定値からダイス物理パラメータを生成。 */
  const rollSettings = useMemo(() => mergeRollSettings(debugSettings), [debugSettings])
  const numericMode = rollSettings.numericMode
  const [settled, setSettled] = useState(false)
  const sessionStartRef = useRef<number>(0)
  const floorMaterial = useMemo(() => ({ name: 'floor' }), [])
  const wallMaterial = useMemo(() => ({ name: 'wall' }), [])
  const diceMaterial = useMemo(() => ({ name: 'dice' }), [])
  const numericTextures = useMemo(() => createNumericFaceTextures(), [])
  const textures = useLoader(TextureLoader, Object.values(iconPaths))
  textures.forEach((texture) => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
  })
  const iconTextures = {
    swordsman: textures[0],
    mage: textures[1],
    tactician: textures[2],
  } satisfies Record<ClassType, THREE.Texture>
  const [resolvedFaces, setResolvedFaces] = useState<Record<string, { faceIndex: number; result: ClassType }>>({})
  const shootersRef = useRef<Record<string, () => void>>({})
  const shouldResetShooters = useRef(false)
  const [resultsDispatched, setResultsDispatched] = useState(false)

  useEffect(() => {
    setResolvedFaces({})
    setSettled(false)
    setResultsDispatched(false)
    shouldResetShooters.current = true
    sessionStartRef.current = Date.now()
  }, [rollSessionId])

  const handleResult = useCallback((id: string, faceIndex: number, result: ClassType) => {
    setResolvedFaces((prev) => (prev[id] ? prev : { ...prev, [id]: { faceIndex, result } }))
  }, [])

  useEffect(() => {
    if (!dice.length || resultsDispatched) return
    const allResolved = dice.every((die) => resolvedFaces[die.id])
    if (!allResolved) return
    const updatedDice = dice.map((die) => {
      const resolved = resolvedFaces[die.id]
      return resolved ? { ...die, faceIndex: resolved.faceIndex, result: resolved.result } : die
    })
    const computedTallies = updatedDice.reduce(
      (acc, die) => {
        if (die.result) {
          acc[die.result] += 1
        }
        return acc
      },
      { swordsman: 0, mage: 0, tactician: 0 } satisfies MovementBudget,
    )
    setSettled(true)
    setResultsDispatched(true)
    onResolve(updatedDice, computedTallies)
  }, [resolvedFaces, dice, onResolve, resultsDispatched])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const callbacks = Object.values(shootersRef.current)
      callbacks.forEach((shoot) => shoot())
    })
    return () => cancelAnimationFrame(frame)
  }, [rollSessionId])

  useEffect(() => {
    if (!settled) return
    const elapsed = Date.now() - sessionStartRef.current
    const remaining = Math.max(0, 10000 - elapsed)
    const timer = setTimeout(() => {
      onClose()
    }, remaining)
    return () => clearTimeout(timer)
  }, [settled, onClose])

  if (!visible) {
    return null
  }

  return (
    <>
      <div className="dice-overlay" aria-hidden="true">
        <div className="dice-stage">
          <Canvas
            shadows
            gl={{ alpha: true, antialias: true }}
            camera={{ position: CAMERA_SETTINGS.position, fov: CAMERA_SETTINGS.fov }}
            onCreated={({ camera }) => {
              camera.position.set(...CAMERA_SETTINGS.position)
              camera.lookAt(0, 0, 0)
            }}
          >
            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 8, 5]} intensity={0.8} castShadow />
          <Physics gravity={[0, -9.81, 0]}>
            <PhysicsMaterials
              floor={floorMaterial}
              wall={wallMaterial}
              dice={diceMaterial}
              contact={rollSettings.contact}
            />
            <FloorAndWalls materials={{ floor: floorMaterial.name, wall: wallMaterial.name }} />
            {dice.map((item, index) => (
              <DiceMesh
                key={item.id}
                type={item.type}
                settled={settled}
                icons={iconTextures}
                material="dice-material"
                onResult={(faceIndex, result) => handleResult(item.id, faceIndex, result)}
                registerShooter={(shoot) => {
                  if (shouldResetShooters.current) {
                    shootersRef.current = {}
                    shouldResetShooters.current = false
                  }
                  shootersRef.current[item.id] = shoot
                }}
                settings={rollSettings}
                index={index}
                total={dice.length}
                numericTextures={numericTextures}
              />
            ))}
          </Physics>
        </Canvas>
        </div>
      </div>
      <div className="dice-overlay__summary">
        {numericMode ? (
          <div className="dice-results-list">
            {dice.map((die) => (
              <p key={die.id}>
                {die.type === 'gold' ? '金' : '銀'}: {die.faceIndex != null ? die.faceIndex + 1 : '---'}
              </p>
            ))}
          </div>
        ) : (
          <p>剣士: {tallies.swordsman} / 魔術師: {tallies.mage} / 策士: {tallies.tactician}</p>
        )}
        {settled ? (
          <button className="primary" onClick={onClose}>
            結果を適用する
          </button>
        ) : (
          <p>物理演算中...</p>
        )}
      </div>
    </>
  )
}
