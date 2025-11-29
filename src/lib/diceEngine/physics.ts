import * as THREE from 'three'
import { Body, Box, ContactMaterial, Material, Vec3, World } from 'cannon-es'
import type { DebugDiceSettings } from '../../types'
import { randomInRange } from './utils'
import { quaternionForValue } from './orientation'

const STAGE_HALF_WIDTH = 4.8
const STAGE_HALF_DEPTH = 4.8
const STAGE_WALL_HEIGHT = 7
const STAGE_WALL_THICKNESS = 0.35
const STAGE_CEILING_HEIGHT = 11
const STAGE_MARGIN = 0.6

export class DicePhysicsStage {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  private container: HTMLElement

  constructor(container: HTMLElement) {
    this.container = container
    this.scene = new THREE.Scene()
    this.scene.background = null
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000)
    this.camera.position.set(0, 18, 0)
    this.camera.lookAt(new THREE.Vector3(0, 0, 0))
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.container.appendChild(this.renderer.domElement)
    this.addLights()
    this.buildFloor()
    this.refreshViewport()
  }

  private addLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.5)
    const directional = new THREE.DirectionalLight(0xffffff, 0.9)
    directional.position.set(-6, 15, 10)
    directional.castShadow = true
    directional.shadow.mapSize.set(1024, 1024)
    this.scene.add(ambient)
    this.scene.add(directional)
  }

  private buildFloor() {
    const floorGeometry = new THREE.PlaneGeometry(30, 30)
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x0a1e0f, roughness: 0.8 })
    const floor = new THREE.Mesh(floorGeometry, floorMaterial)
    floor.receiveShadow = true
    floor.rotation.x = -Math.PI / 2
    floor.visible = false
    this.scene.add(floor)
  }

  refreshViewport = () => {
    const { clientWidth, clientHeight } = this.container
    if (clientWidth === 0 || clientHeight === 0) return
    this.renderer.setSize(clientWidth, clientHeight, false)
    this.camera.aspect = clientWidth / clientHeight
    this.camera.updateProjectionMatrix()
  }

  dispose() {
    this.container.removeChild(this.renderer.domElement)
    this.renderer.dispose()
  }
}

export interface DicePhysicsWorld {
  world: World
  diceMaterial: Material
  floorMaterial: Material
  wallMaterial: Material
  floorContact: ContactMaterial
  wallContact: ContactMaterial
}

export const buildPhysicsWorld = (settings: DebugDiceSettings): DicePhysicsWorld => {
  const world = new World({ gravity: new Vec3(0, -9.82, 0) })
  const diceMaterial = new Material('dice')
  const floorMaterial = new Material('floor')
  const wallMaterial = new Material('wall')
  const floorContact = new ContactMaterial(diceMaterial, floorMaterial, {})
  const wallContact = new ContactMaterial(diceMaterial, wallMaterial, {})
  world.addContactMaterial(floorContact)
  world.addContactMaterial(wallContact)
  addStageBodies(world, floorMaterial, wallMaterial)
  const stage = { world, diceMaterial, floorMaterial, wallMaterial, floorContact, wallContact }
  applyContactSettings(stage, settings)
  return stage
}

export const applyContactSettings = (stage: DicePhysicsWorld, settings: DebugDiceSettings) => {
  stage.floorContact.friction = settings.contact.floorFriction
  stage.floorContact.restitution = settings.contact.floorRestitution
  stage.wallContact.friction = settings.contact.wallFriction
  stage.wallContact.restitution = settings.contact.wallRestitution
}

const addStageBodies = (world: World, floorMaterial: Material, wallMaterial: Material) => {
  const floorBody = new Body({
    mass: 0,
    material: floorMaterial,
    shape: new Box(new Vec3(STAGE_HALF_WIDTH, 0.5, STAGE_HALF_DEPTH)),
  })
  floorBody.position.set(0, -0.5, 0)
  world.addBody(floorBody)
  const wallShapeX = new Box(new Vec3(STAGE_WALL_THICKNESS, STAGE_WALL_HEIGHT, STAGE_HALF_DEPTH))
  const wallShapeZ = new Box(new Vec3(STAGE_HALF_WIDTH, STAGE_WALL_HEIGHT, STAGE_WALL_THICKNESS))
  const sideWalls: [number, number, number][] = [
    [STAGE_HALF_WIDTH + STAGE_WALL_THICKNESS, STAGE_WALL_HEIGHT, 0],
    [-STAGE_HALF_WIDTH - STAGE_WALL_THICKNESS, STAGE_WALL_HEIGHT, 0],
  ]
  sideWalls.forEach(([x, y, z]) => {
    const wall = new Body({ mass: 0, material: wallMaterial, shape: wallShapeX })
    wall.position.set(x, y, z)
    world.addBody(wall)
  })
  const frontWalls: [number, number, number][] = [
    [0, STAGE_WALL_HEIGHT, STAGE_HALF_DEPTH + STAGE_WALL_THICKNESS],
    [0, STAGE_WALL_HEIGHT, -STAGE_HALF_DEPTH - STAGE_WALL_THICKNESS],
  ]
  frontWalls.forEach(([x, y, z]) => {
    const wall = new Body({ mass: 0, material: wallMaterial, shape: wallShapeZ })
    wall.position.set(x, y, z)
    world.addBody(wall)
  })
  const ceiling = new Body({
    mass: 0,
    material: wallMaterial,
    shape: new Box(new Vec3(STAGE_HALF_WIDTH, 0.5, STAGE_HALF_DEPTH)),
  })
  ceiling.position.set(0, STAGE_CEILING_HEIGHT + 0.5, 0)
  world.addBody(ceiling)
}

interface DieBodyOptions {
  settings: DebugDiceSettings
  world: DicePhysicsWorld
  targetValue?: number
  index: number
  total: number
}

export const createDiceBody = ({ settings, world, targetValue, index, total }: DieBodyOptions) => {
  const body = new Body({
    mass: settings.body.mass,
    shape: new Box(new Vec3(settings.dieSize / 2, settings.dieSize / 2, settings.dieSize / 2)),
    material: world.diceMaterial,
    linearDamping: settings.body.linearDamping,
    angularDamping: settings.body.angularDamping,
  })
  positionAndLaunch(body, index, total, targetValue, settings)
  world.world.addBody(body)
  return body
}

const positionAndLaunch = (
  body: Body,
  index: number,
  total: number,
  targetValue: number | undefined,
  settings: DebugDiceSettings,
) => {
  const clamp = (value: number, halfSize: number) =>
    Math.max(-halfSize + STAGE_MARGIN, Math.min(halfSize - STAGE_MARGIN, value))
  const spread = settings.launchSpread
  const offset = (index - (total - 1) / 2) * spread
  const x = clamp(settings.launchOrigin.x + offset + randomInRange(-0.3, 0.3), STAGE_HALF_WIDTH)
  const y = Math.min(settings.spawnHeight + randomInRange(0, 1), STAGE_CEILING_HEIGHT - STAGE_MARGIN)
  const z = clamp(settings.launchOrigin.z + randomInRange(-spread, spread), STAGE_HALF_DEPTH)
  body.position.set(x, y, z)
  const face = targetValue ?? Math.ceil(Math.random() * 6)
  body.quaternion.copy(quaternionForValue(face))
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

export { STAGE_HALF_WIDTH, STAGE_HALF_DEPTH }
