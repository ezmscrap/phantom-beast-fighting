import { Canvas, useLoader } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Physics, useBox, usePlane, useContactMaterial } from '@react-three/cannon'
import { Suspense, useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { TextureLoader } from 'three'
import { GOLD_FACES, SILVER_FACES, diceFaceColors } from '../constants'
import type { ClassType, DebugDiceSettings, DiceType, MovementBudget } from '../types'

export interface DiceVisual {
  id: string
  type: DiceType
  faceIndex: number
  result: ClassType
}

interface DiceRollerOverlayProps {
  dice: DiceVisual[]
  tallies: MovementBudget
  visible: boolean
  onClose: () => void
  settings?: DebugDiceSettings
}

const FACE_DEFINITIONS: Record<DiceType, ClassType[]> = {
  silver: SILVER_FACES,
  gold: GOLD_FACES,
}

const DiceMesh = ({
  type,
  faceIndex,
  settled,
  settings,
  icons,
  material,
}: {
  type: DiceType
  faceIndex: number
  settled: boolean
  settings: DebugDiceSettings
  icons: Record<ClassType, THREE.Texture>
  material: string
}) => {
  const dieSize = settings.dieSize
  const spawnHeight = Math.max(settings.spawnHeight, 3)
  const startX = 6
  const startZ = 2
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

  useEffect(() => {
    if (!settled) {
      const { x, y, z, torque, minHorizontal } = settings.impulse
      const towardCenterX = -(minHorizontal + Math.random() * x * 1.8)
      const lateralZ = (Math.random() - 0.5) * z * 1.4
      api.applyImpulse([towardCenterX, y + Math.random() * 3, lateralZ], [0, 0, 0])
      api.velocity.set(towardCenterX * 0.3, y * 0.2, lateralZ * 0.3)
      api.applyTorque([towardCenterX * 0.4, torque * (Math.random() - 0.5), lateralZ * 0.4])
      return
    }
  }, [api, faceIndex, settled, settings])

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

const FloorAndWalls = ({ materials }: { materials: { floor: string; wall: string } }) => {
  const [floorRef] = usePlane<THREE.Mesh>(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, 0, 0],
    type: 'Static',
    material: materials.floor,
  }))

  const wallMaterialProps = {
    color: '#cfe2ff',
    opacity: 0.04,
    transparent: true,
    depthWrite: false,
  }

  const createWall = (position: [number, number, number], rotation: [number, number, number]) => {
    const [wallRef] = useBox<THREE.Mesh>(() => ({
      args: [12, 4, 0.5],
      position,
      rotation,
      type: 'Static',
      material: materials.wall,
    }))
    return (
      <mesh key={`${position.join('-')}`} ref={wallRef}>
        <boxGeometry args={[12, 4, 0.5]} />
        <meshPhysicalMaterial {...wallMaterialProps} />
      </mesh>
    )
  }

  return (
    <>
      <mesh ref={floorRef} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshPhysicalMaterial color="#cfe2ff" opacity={0.03} transparent depthWrite={false} />
      </mesh>
      {createWall([0, 2, -6], [0, 0, 0])}
      {createWall([0, 2, 6], [0, 0, 0])}
      {createWall([-6, 2, 0], [0, Math.PI / 2, 0])}
      {createWall([6, 2, 0], [0, Math.PI / 2, 0])}
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

export const DiceRollerOverlay = ({ dice, visible, onClose, tallies, settings }: DiceRollerOverlayProps) => {
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

  useEffect(() => {
    if (!visible) return
    setSettled(false)
    const timer = setTimeout(() => setSettled(true), 2800)
    return () => clearTimeout(timer)
  }, [visible, dice])

  if (!visible) {
    return null
  }

  return (
    <div className="dice-overlay">
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
              faceIndex={item.faceIndex}
              settled={settled}
              settings={
                settings ?? {
                  dieSize: 0.45,
                  spawnHeight: 4,
                  impulse: { x: 7, y: 5, z: 7, torque: 7, minHorizontal: 1.2 },
                }
              }
              icons={iconTextures}
              material="dice-material"
            />
          ))}
        </Physics>
        <Suspense fallback={null}>
          <OrbitControls enablePan={false} enableZoom={false} />
        </Suspense>
      </Canvas>
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
