import * as THREE from 'three'
import { Quaternion as CannonQuaternion, Vec3 } from 'cannon-es'
import { FACE_NORMALS } from './constants'
import { randomInRange } from './utils'

const UP_VECTOR = new Vec3(0, 1, 0)

const toCannonQuaternion = (quaternion: THREE.Quaternion) =>
  new CannonQuaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w)

export const quaternionForValue = (value: number) => {
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

export const determineFaceValue = (quaternion: CannonQuaternion): number => {
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
