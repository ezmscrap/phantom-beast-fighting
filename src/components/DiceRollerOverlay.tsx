import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Physics, useBox, usePlane, useContactMaterial } from '@react-three/cannon'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { TextureLoader } from 'three'
import { GOLD_FACES, SILVER_FACES, diceFaceColors } from '../constants'
import type { ClassType, DiceType, MovementBudget } from '../types'

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
}

const FACE_DEFINITIONS: Record<DiceType, ClassType[]> = {
  silver: SILVER_FACES,
  gold: GOLD_FACES,
}

/**
 * 各ダイスの3Dモデルと物理挙動を管理するコンポーネント。
 * 位置/速度を監視し、一定時間静止したら出目を通知する。
 */
const DEFAULT_ROLL_SETTINGS = {
  dieSize: 0.5,
  spawnHeight: 6,
  impulse: {
    x: 6,
    y: 5,
    z: 6,
    torque: 8,
  },
  launchOrigin: {
    x: 4,
    z: -4,
  },
  launchVector: {
    x: -6,
    z: 6,
  },
} as const

const DiceMesh = ({
  type,
  settled,
  icons,
  material,
  onResult,
  registerShooter,
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
}) => {
  /** ダイスモデルの一辺。設定から取得し、形状/座標計算に使用。 */
  const dieSize = DEFAULT_ROLL_SETTINGS.dieSize
  /** ダイスを落とす初期高さ。最低3以上に補正し、落下演出の安定性を確保。 */
  const spawnHeight = Math.max(DEFAULT_ROLL_SETTINGS.spawnHeight, 3)
  /** ダイスを投げ込む開始位置（画面右上を想定した固定座標）。 */
  const startX = DEFAULT_ROLL_SETTINGS.launchOrigin.x
  /** ダイスの開始位置（右上から中央へ向けるための固定Z）。 */
  const startZ = DEFAULT_ROLL_SETTINGS.launchOrigin.z
  /**
   * useBoxでcannonボディを生成。サイズ/質量/減衰などを設定し、
   * 乱数を使って初期姿勢をバラつかせる。
   */
  const [ref, api] = useBox<THREE.Group>(() => ({
    args: [dieSize, dieSize, dieSize],
    mass: 0.55,
    linearDamping: 0.08,
    angularDamping: 0.05,
    position: [
      startX,
      Math.random() * 0.5 + spawnHeight,
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
      const { y } = DEFAULT_ROLL_SETTINGS.impulse
      const impulseX = DEFAULT_ROLL_SETTINGS.launchVector.x
      const impulseZ = DEFAULT_ROLL_SETTINGS.launchVector.z
      api.applyImpulse([impulseX, y + 2.5, impulseZ], [0, 0, 0])
      api.velocity.set(impulseX * 0.4, y * 0.2, impulseZ * 0.4)
      api.applyTorque([impulseX * 0.5, DEFAULT_ROLL_SETTINGS.impulse.torque * 0.2, impulseZ * 0.5])
    }
  }, [api, settled])

  useEffect(() => {
    registerShooter(shoot)
  }, [registerShooter, shoot])

  /**
   * 毎フレーム速度を監視し、一定フレーム静止したら上面の向きを判定して出目を通知する。
   * 静止判定に linearSpeed/ angularSpeed を使用。
   */
  useFrame(() => {
    if (resolvedRef.current) return
    const linear = velocity.current
    const angular = angularVelocity.current
    const linearSpeed = Math.hypot(linear[0], linear[1], linear[2])
    const angularSpeed = Math.hypot(angular[0], angular[1], angular[2])
    if (linearSpeed < 0.2 && angularSpeed < 0.2) {
      stillFrames.current += 1
      if (stillFrames.current > 20 && ref.current) {
        resolvedRef.current = true
        const quaternion = ref.current.getWorldQuaternion(new THREE.Quaternion())
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion)
        const axisContributions = [
          { index: 0, value: up.x },
          { index: 1, value: -up.x },
          { index: 2, value: up.y },
          { index: 3, value: -up.y },
          { index: 4, value: up.z },
          { index: 5, value: -up.z },
        ]
        const topFace = axisContributions.reduce((prev, current) =>
          current.value > prev.value ? current : prev,
        )
        const faceDefinitions = type === 'silver' ? SILVER_FACES : GOLD_FACES
        const result = faceDefinitions[topFace.index]
        onResult(topFace.index, result)
      }
    } else {
      stillFrames.current = 0
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
      {FACE_DEFINITIONS[type].map((face, index) => {
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
        const transform = transforms[index]
        return (
          <mesh
            key={`${face}-${index}`}
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
      args: [16, 5, 0.5],
      position,
      rotation,
      type: 'Static',
      material: materials.wall,
    }))
    return <mesh key={`${position.join('-')}`} ref={wallRef} />
  }

  return (
    <>
      <mesh ref={floorRef} receiveShadow>
        <planeGeometry args={[16, 16]} />
        <meshPhysicalMaterial color="#cfe2ff" opacity={0.01} transparent depthWrite={false} />
      </mesh>
      {createWall([0, 2.5, -4.8], [0, 0, 0])}
      {createWall([0, 2.5, 4.8], [0, 0, 0])}
      {createWall([-4.8, 2.5, 0], [0, Math.PI / 2, 0])}
      {createWall([4.8, 2.5, 0], [0, Math.PI / 2, 0])}
    </>
  )
}

const iconPaths: Record<ClassType, string> = {
  swordsman: '/icons/swords.svg',
  mage: '/icons/wand.svg',
  tactician: '/icons/chess.svg',
}

const PhysicsMaterials = ({ floor, wall, dice }: { floor: { name: string; friction: number; restitution: number }; wall: { name: string; friction: number; restitution: number }; dice: { name: string; friction: number; restitution: number } }) => {
  useContactMaterial(floor, dice, { friction: 0.25, restitution: 0.5 })
  useContactMaterial(wall, dice, { friction: 0.08, restitution: 0.35 })
  return null
}

export const DiceRollerOverlay = ({
  dice,
  visible,
  onClose,
  tallies,
  rollSessionId,
  onResolve,
}: DiceRollerOverlayProps) => {
  const [settled, setSettled] = useState(false)
  const floorMaterial = useMemo(() => ({ name: 'floor', friction: 0.32, restitution: 0.45 }), [])
  const wallMaterial = useMemo(() => ({ name: 'wall', friction: 0.06, restitution: 0.3 }), [])
  const diceMaterial = useMemo(() => ({ name: 'dice', friction: 0.2, restitution: 0.6 }), [])
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
    const timer = setTimeout(() => {
      onClose()
    }, 5000)
    return () => clearTimeout(timer)
  }, [settled, onClose])

  if (!visible) {
    return null
  }

  return (
    <div className="dice-overlay">
      <div className="dice-stage">
        <Canvas shadows gl={{ alpha: true, antialias: true }} camera={{ position: [-6, 7, 6], fov: 40 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 8, 5]} intensity={0.8} castShadow />
          <Physics gravity={[0, -9.81, 0]}>
            <PhysicsMaterials floor={floorMaterial} wall={wallMaterial} dice={diceMaterial} />
            <FloorAndWalls materials={{ floor: floorMaterial.name, wall: wallMaterial.name }} />
            {dice.map((item) => (
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
              />
            ))}
          </Physics>
          <Suspense fallback={null}>
            <OrbitControls enablePan={false} enableZoom={false} />
          </Suspense>
        </Canvas>
      </div>
      <div className="dice-overlay__summary">
        <p>剣士: {tallies.swordsman} / 魔術師: {tallies.mage} / 策士: {tallies.tactician}</p>
        {settled ? (
          <button className="primary" onClick={onClose}>
            結果を適用する
          </button>
        ) : (
          <p>物理演算中...</p>
        )}
      </div>
    </div>
  )
}
