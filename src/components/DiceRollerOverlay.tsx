import { Canvas } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import { Physics, useBox, usePlane } from '@react-three/cannon'
import { Suspense, useEffect, useState } from 'react'
import * as THREE from 'three'
import { GOLD_FACES, SILVER_FACES, diceFaceColors, diceFaceLabels } from '../constants'
import type { ClassType, DiceType, MovementBudget } from '../types'

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
}: {
  type: DiceType
  faceIndex: number
  settled: boolean
}) => {
  const [ref, api] = useBox(() => ({
    args: [1, 1, 1],
    mass: 1,
    position: [
      (Math.random() - 0.5) * 2,
      Math.random() * 2 + 5,
      (Math.random() - 0.5) * 2,
    ],
    rotation: [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI],
  }))

  useEffect(() => {
    if (!settled) {
      api.applyImpulse(
        [
          (Math.random() - 0.5) * 5,
          Math.random() * 5 + 5,
          (Math.random() - 0.5) * 5,
        ],
        [0, 0, 0],
      )
      return
    }
    const [x, y, z] = FACE_ROTATIONS[faceIndex]
    api.rotation.set(x, y, z)
    api.velocity.set(0, 0, 0)
    api.angularVelocity.set(0, 0, 0)
    api.position.set((Math.random() - 0.5) * 2, 1.5, (Math.random() - 0.5) * 2)
  }, [api, faceIndex, settled])

  const color = diceFaceColors[type]
  const textColor = type === 'gold' ? '#2c1900' : '#123c6b'
  return (
    <group ref={ref as React.MutableRefObject<THREE.Group>}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
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
        switch (index) {
          case 0:
            return (
              <Text key={index} position={[0.51, 0, 0]} rotation={[0, Math.PI / 2, 0]} {...textProps} />
            )
          case 1:
            return (
              <Text key={index} position={[-0.51, 0, 0]} rotation={[0, -Math.PI / 2, 0]} {...textProps} />
            )
          case 2:
            return <Text key={index} position={[0, 0.51, 0]} rotation={[Math.PI / 2, 0, 0]} {...textProps} />
          case 3:
            return (
              <Text key={index} position={[0, -0.51, 0]} rotation={[-Math.PI / 2, 0, 0]} {...textProps} />
            )
          case 4:
            return (
              <Text key={index} position={[0, 0, 0.51]} rotation={[0, 0, 0]} {...textProps} />
            )
          case 5:
            return (
              <Text key={index} position={[0, 0, -0.51]} rotation={[0, Math.PI, 0]} {...textProps} />
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
    opacity: 0.1,
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
        <meshPhysicalMaterial color="#cfe2ff" opacity={0.08} transparent depthWrite={false} />
      </mesh>
      {createWall([0, 2, -6], [0, 0, 0])}
      {createWall([0, 2, 6], [0, 0, 0])}
      {createWall([-6, 2, 0], [0, Math.PI / 2, 0])}
      {createWall([6, 2, 0], [0, Math.PI / 2, 0])}
    </>
  )
}

export const DiceRollerOverlay = ({ dice, visible, onClose, tallies }: DiceRollerOverlayProps) => {
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
      <Canvas shadows camera={{ position: [0, 6, 8], fov: 40 }}>
        <color attach="background" args={['#05060a']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 8, 5]} intensity={0.8} castShadow />
        <Physics gravity={[0, -9.81, 0]}>
          <FloorAndWalls />
          {dice.map((item) => (
            <DiceMesh key={item.id} type={item.type} faceIndex={item.faceIndex} settled={settled} />
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
