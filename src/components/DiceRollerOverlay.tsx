import { Canvas } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import { Physics, useBox, usePlane } from '@react-three/cannon'
import { Suspense, useEffect, useState } from 'react'
import * as THREE from 'three'
import { GOLD_FACES, SILVER_FACES, diceFaceColors, diceFaceLabels } from '../constants'
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

const FACE_ROTATIONS: [number, number, number][] = [
  [0, 0, -Math.PI / 2],
  [0, 0, Math.PI / 2],
  [0, 0, 0],
  [Math.PI, 0, 0],
  [Math.PI / 2, 0, 0],
  [-Math.PI / 2, 0, 0],
]

const FACE_DEFINITIONS: Record<DiceType, ClassType[]> = {
  silver: SILVER_FACES,
  gold: GOLD_FACES,
}

const DiceMesh = ({
  type,
  faceIndex,
  settled,
  settings,
}: {
  type: DiceType
  faceIndex: number
  settled: boolean
  settings: DebugDiceSettings
}) => {
  const dieSize = settings.dieSize
  const [ref, api] = useBox(() => ({
    args: [dieSize, dieSize, dieSize],
    mass: 0.6,
    linearDamping: 0.12,
    angularDamping: 0.08,
    position: [
      (Math.random() - 0.5) * 1.5,
      Math.random() * 1.5 + 4,
      (Math.random() - 0.5) * 1.5,
    ],
    rotation: [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI],
  }))

  useEffect(() => {
    if (!settled) {
      const { x, y, z, torque } = settings.impulse
      const random = (base: number) => (Math.random() - 0.5) * base
      api.applyImpulse([random(x), y + Math.random() * 1.5, random(z)], [0, 0, 0])
      api.applyTorque([random(torque), random(torque), random(torque)])
      return
    }
    const [x, y, z] = FACE_ROTATIONS[faceIndex]
    api.rotation.set(x, y, z)
    api.velocity.set(0, 0, 0)
    api.angularVelocity.set(0, 0, 0)
    api.position.set((Math.random() - 0.5) * 2, dieSize, (Math.random() - 0.5) * 2)
  }, [api, faceIndex, settled, settings])

  const color = diceFaceColors[type]
  const textColor = type === 'gold' ? '#2c1900' : '#123c6b'
  return (
    <group ref={ref as React.MutableRefObject<THREE.Group>}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[dieSize, dieSize, dieSize]} />
        {[...Array(6)].map((_, index) => (
          <meshStandardMaterial key={index} color={color} />
        ))}
      </mesh>
      {FACE_DEFINITIONS[type].map((face, index) => {
        const label = diceFaceLabels[face]
        const textProps = {
          fontSize: 0.35,
          color: textColor,
          anchorX: 'center' as const,
          anchorY: 'middle' as const,
          children: label,
        }
        const offset = dieSize / 2 + 0.04
        switch (index) {
          case 0:
            return (
              <Text key={index} position={[offset, 0, 0]} rotation={[0, Math.PI / 2, 0]} {...textProps} />
            )
          case 1:
            return (
              <Text key={index} position={[-offset, 0, 0]} rotation={[0, -Math.PI / 2, 0]} {...textProps} />
            )
          case 2:
            return <Text key={index} position={[0, offset, 0]} rotation={[Math.PI / 2, 0, 0]} {...textProps} />
          case 3:
            return (
              <Text key={index} position={[0, -offset, 0]} rotation={[-Math.PI / 2, 0, 0]} {...textProps} />
            )
          case 4:
            return (
              <Text key={index} position={[0, 0, offset]} rotation={[0, 0, 0]} {...textProps} />
            )
          case 5:
            return (
              <Text key={index} position={[0, 0, -offset]} rotation={[0, Math.PI, 0]} {...textProps} />
            )
          default:
            return null
        }
      })}
    </group>
  )
}

const FloorAndWalls = () => {
  const [floorRef] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, 0, 0],
    type: 'Static',
  }))

  const wallMaterialProps = {
    color: '#cfe2ff',
    opacity: 0.04,
    transparent: true,
    depthWrite: false,
  }

  const createWall = (position: [number, number, number], rotation: [number, number, number]) => {
    const [wallRef] = useBox(() => ({
      args: [12, 4, 0.5],
      position,
      rotation,
      type: 'Static',
    }))
    return (
      <mesh key={`${position.join('-')}`} ref={wallRef as React.MutableRefObject<THREE.Mesh>}>
        <boxGeometry args={[12, 4, 0.5]} />
        <meshPhysicalMaterial {...wallMaterialProps} />
      </mesh>
    )
  }

  return (
    <>
      <mesh ref={floorRef as React.MutableRefObject<THREE.Mesh>} receiveShadow>
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

export const DiceRollerOverlay = ({ dice, visible, onClose, tallies, settings }: DiceRollerOverlayProps) => {
  const [settled, setSettled] = useState(false)

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
      <Canvas shadows gl={{ alpha: true, antialias: true }} camera={{ position: [0, 6, 8], fov: 40 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 8, 5]} intensity={0.8} castShadow />
        <Physics gravity={[0, -9.81, 0]}>
          <FloorAndWalls />
          {dice.map((item) => (
            <DiceMesh
              key={item.id}
              type={item.type}
              faceIndex={item.faceIndex}
              settled={settled}
              settings={
                settings ?? {
                  dieSize: 0.45,
                  impulse: { x: 7, y: 5, z: 7, torque: 7 },
                }
              }
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
