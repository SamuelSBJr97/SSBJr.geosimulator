import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Color, Matrix4, Vector3 } from 'three'
import type { InstancedMesh, Mesh } from 'three'

export type GeoSceneProps = {
  seed: number
  cameraMode: 'first' | 'iso'
}

type TerrainData = {
  positions: Vector3[]
  colors: Color[]
  heights: number[]
}

const PLANET_RADIUS = 4.8
const VOXEL_SIZE = 1.0
const WORLD_SIZE = 50
const LAT_STEPS = 28
const LON_STEPS = 52
const EARTH_AXIAL_TILT = (23.44 * Math.PI) / 180
const STEP_MAX = VOXEL_SIZE * 2.6
const DECAL_IGNORE = VOXEL_SIZE * 0.6
const PLAYER_RADIUS = 0.3
const PLAYER_HEIGHT = 1.7
const GRAVITY_SPRING = 10
const GRAVITY_DAMP = 4.5

const COLORS = {
  ocean: new Color('#1c4fa1'),
  rock: new Color('#f5f5f5'),
  lava: new Color('#ff5a3c'),
  sand: new Color('#c2a46b'),
  grass: new Color('#4a7c59'),
  snow: new Color('#ffffff'),
  dirt: new Color('#8B4513'),
}

function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function seededNoise(seed: number, i: number, j: number) {
  const mixed = seed ^ (i * 374761393) ^ (j * 668265263)
  const rng = mulberry32(mixed)
  return rng()
}

function generatePlanet(seed: number): TerrainData {
  const positions: Vector3[] = []
  const colors: Color[] = []
  const heights = new Array<number>(WORLD_SIZE * WORLD_SIZE).fill(1)

  // Base rolling ground: mostly dirt with grassy tops
  for (let x = -WORLD_SIZE / 2; x < WORLD_SIZE / 2; x++) {
    for (let z = -WORLD_SIZE / 2; z < WORLD_SIZE / 2; z++) {
      const noise = seededNoise(seed, x, z)
      const height = Math.max(1, Math.floor(1 + noise * 2.5)) // gentle variation
      const index = (x + WORLD_SIZE / 2) * WORLD_SIZE + (z + WORLD_SIZE / 2)
      heights[index] = height

      for (let y = 0; y < height; y++) {
        positions.push(new Vector3(x * VOXEL_SIZE, y * VOXEL_SIZE, z * VOXEL_SIZE))
        // flat ground is dirt only
        colors.push(COLORS.dirt)
      }
    }
  }

  // Create several marble-quarry style rectangular blocks and carved pits
  const rng = mulberry32(seed + 12345)
  const numQuarries = 3 + Math.floor(rng() * 3) // 3-5 quarries

  for (let q = 0; q < numQuarries; q++) {
    const w = 6 + Math.floor(rng() * 10) // width 6-15
    const l = 6 + Math.floor(rng() * 10) // length
    const h = 3 + Math.floor(rng() * 6) // height 3-8

    const cx = Math.floor(rng() * (WORLD_SIZE - w)) - WORLD_SIZE / 2
    const cz = Math.floor(rng() * (WORLD_SIZE - l)) - WORLD_SIZE / 2

    // Carve a pit by lowering ground heights inside footprint (stepped terraces)
    for (let dx = 0; dx < w; dx++) {
      for (let dz = 0; dz < l; dz++) {
        const gx = cx + dx
        const gz = cz + dz
        if (gx < -WORLD_SIZE / 2 || gx >= WORLD_SIZE / 2 || gz < -WORLD_SIZE / 2 || gz >= WORLD_SIZE / 2) continue
        const idx = (gx + WORLD_SIZE / 2) * WORLD_SIZE + (gz + WORLD_SIZE / 2)
        // lower height to create pit base (leave some steps)
        heights[idx] = Math.max(0, (heights[idx] || 1) - (Math.floor(h / 2) + Math.floor(rng() * 2)))
      }
    }

    // Place large rectangular marble blocks (exposed faces)
    for (let dx = 0; dx < w; dx++) {
      for (let dz = 0; dz < l; dz++) {
        const gx = cx + dx
        const gz = cz + dz
        if (gx < -WORLD_SIZE / 2 || gx >= WORLD_SIZE / 2 || gz < -WORLD_SIZE / 2 || gz >= WORLD_SIZE / 2) continue
        const idx = (gx + WORLD_SIZE / 2) * WORLD_SIZE + (gz + WORLD_SIZE / 2)
        const baseH = Math.max(0, heights[idx] || 0)
        // Build vertical cut blocks along the quarry walls: stack rock blocks up to h
        for (let by = 0; by < h; by++) {
          positions.push(new Vector3(gx * VOXEL_SIZE, (baseH + by) * VOXEL_SIZE, gz * VOXEL_SIZE))
          colors.push(COLORS.rock)
        }
      }
    }
  }

  // Add some isolated marble blocks for variety
  for (let i = 0; i < 8; i++) {
    const x = Math.floor(Math.random() * (WORLD_SIZE - 4)) - WORLD_SIZE / 2
    const z = Math.floor(Math.random() * (WORLD_SIZE - 4)) - WORLD_SIZE / 2
    const baseIdx = (x + WORLD_SIZE / 2) * WORLD_SIZE + (z + WORLD_SIZE / 2)
    const baseH = Math.max(0, heights[baseIdx] || 0)
    const bw = 3
    const bl = 3
    const bh = 3
    for (let dx = 0; dx < bw; dx++) {
      for (let dz = 0; dz < bl; dz++) {
        for (let dy = 0; dy < bh; dy++) {
          positions.push(new Vector3((x + dx) * VOXEL_SIZE, (baseH + dy) * VOXEL_SIZE, (z + dz) * VOXEL_SIZE))
          colors.push(COLORS.rock)
        }
      }
    }
  }

  return { positions, colors, heights }
}

function PlanetVoxels({ terrain, setTerrain }: { terrain: TerrainData; setTerrain: (t: TerrainData) => void }) {
  const dirtTexture = useTexture('/textures/dirt.jpg')
  const rockTexture = useTexture('/textures/rock.jpg')

  const removeVoxel = (index: number) => {
    const newPositions = terrain.positions.filter((_, i) => i !== index)
    const newColors = terrain.colors.filter((_, i) => i !== index)
    setTerrain({ ...terrain, positions: newPositions, colors: newColors })
  }

  return (
    <group>
      {terrain.positions.map((position, index) => {
        const color = terrain.colors[index]
        const isDirt = color.equals(COLORS.dirt)
        const isRock = color.equals(COLORS.rock)
        return (
          <mesh key={index} position={position} onClick={() => removeVoxel(index)}>
            <boxGeometry args={[VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE]} />
            <meshStandardMaterial
              map={isDirt ? dirtTexture : isRock ? rockTexture : undefined}
              color={color}
              roughness={0.9}
              metalness={0.05}
            />
          </mesh>
        )
      })}
    </group>
  )
}

function useKeyboard() {
  const keysRef = useRef({
    forward: false,
    back: false,
    left: false,
    right: false,
    rotateLeft: false,
    rotateRight: false,
    rotateUp: false,
    rotateDown: false,
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'KeyW':
          keysRef.current.forward = true
          break
        case 'KeyS':
          keysRef.current.back = true
          break
        case 'KeyA':
          keysRef.current.left = true
          break
        case 'KeyD':
          keysRef.current.right = true
          break
        case 'ArrowLeft':
          keysRef.current.rotateLeft = true
          break
        case 'ArrowRight':
          keysRef.current.rotateRight = true
          break
        case 'ArrowUp':
          keysRef.current.rotateUp = true
          break
        case 'ArrowDown':
          keysRef.current.rotateDown = true
          break
        default:
          break
      }
    }

    const onKeyUp = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'KeyW':
          keysRef.current.forward = false
          break
        case 'KeyS':
          keysRef.current.back = false
          break
        case 'KeyA':
          keysRef.current.left = false
          break
        case 'KeyD':
          keysRef.current.right = false
          break
        case 'ArrowLeft':
          keysRef.current.rotateLeft = false
          break
        case 'ArrowRight':
          keysRef.current.rotateRight = false
          break
        case 'ArrowUp':
          keysRef.current.rotateUp = false
          break
        case 'ArrowDown':
          keysRef.current.rotateDown = false
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  return keysRef
}

function sampleSurfaceHeight(position: Vector3, heights: number[]) {
  const x = Math.round(position.x / VOXEL_SIZE)
  const z = Math.round(position.z / VOXEL_SIZE)
  const clampedX = Math.max(-WORLD_SIZE / 2, Math.min(WORLD_SIZE / 2 - 1, x))
  const clampedZ = Math.max(-WORLD_SIZE / 2, Math.min(WORLD_SIZE / 2 - 1, z))
  const index = (clampedX + WORLD_SIZE / 2) * WORLD_SIZE + (clampedZ + WORLD_SIZE / 2)
  return heights[index] * VOXEL_SIZE
}

type PlayerState = {
  position: Vector3
  forward: Vector3
  normal: Vector3
}

function Player({
  stateRef,
  terrain,
}: {
  stateRef: React.MutableRefObject<PlayerState>
  terrain: TerrainData
}) {
  const meshRef = useRef<Mesh>(null!)
  const helperMeshRef = useRef<Mesh>(null!)
  const keys = useKeyboard()

  const positionRef = useRef<Vector3>(stateRef.current.position)
  const forwardRef = useRef<Vector3>(stateRef.current.forward)
  const yawRef = useRef<number>(0)
  const pitchRef = useRef<number>(0)

  // helper cylinder is rendered as a child mesh in JSX below

  useFrame((state, delta) => {
    const { camera } = state

    // Rotation from arrow keys
    const rotSpeed = 1.8 // radians per second
    if (keys.current.rotateLeft) yawRef.current -= rotSpeed * delta
    if (keys.current.rotateRight) yawRef.current += rotSpeed * delta
    if (keys.current.rotateUp) pitchRef.current = Math.min(0.8, pitchRef.current + rotSpeed * delta)
    if (keys.current.rotateDown) pitchRef.current = Math.max(-0.4, pitchRef.current - rotSpeed * delta)

    // Update forward vector from yaw
    forwardRef.current.set(Math.sin(yawRef.current), 0, -Math.cos(yawRef.current)).normalize()

    // Movement relative to forward/right
    const move = new Vector3()
    if (keys.current.forward) move.add(forwardRef.current)
    if (keys.current.back) move.add(forwardRef.current.clone().negate())
    const right = new Vector3(-forwardRef.current.z, 0, forwardRef.current.x).normalize()
    if (keys.current.left) move.add(right.clone().negate())
    if (keys.current.right) move.add(right)

    if (move.length() > 0) {
      move.normalize().multiplyScalar(delta * 5)
      positionRef.current.add(move)
    }

    // Keep player on flat surface
    positionRef.current.y = sampleSurfaceHeight(positionRef.current, terrain.heights) + PLAYER_HEIGHT

    // Camera follows player and looks in forward direction with pitch
    const lookAt = positionRef.current.clone().add(forwardRef.current.clone().setY(Math.tan(pitchRef.current)))
    camera.position.copy(positionRef.current)
    camera.lookAt(lookAt)

    stateRef.current.position.copy(positionRef.current)
    stateRef.current.forward.copy(forwardRef.current)
  })

  return (
    <mesh ref={meshRef} position={positionRef.current}>
      <capsuleGeometry args={[PLAYER_RADIUS, 0.3, 6, 12]} />
      <meshStandardMaterial color="#e9f2ff" roughness={0.4} />
    </mesh>
  )
}

function CameraRig({ mode, stateRef }: { mode: GeoSceneProps['cameraMode']; stateRef: React.MutableRefObject<PlayerState> }) {
  const { camera } = useThree()
  const orbitRef = useRef({
    azimuth: Math.PI / 4,
    polar: Math.PI / 3,
    distance: 50,
    dragging: false,
    lastX: 0,
    lastY: 0,
  })
  const temp = useMemo(
    () => ({
      offset: new Vector3(),
      target: new Vector3(),
      up: new Vector3(0, 1, 0),
    }),
    [],
  )

  useEffect(() => {
    if (mode !== 'iso') return

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      orbitRef.current.dragging = true
      orbitRef.current.lastX = event.clientX
      orbitRef.current.lastY = event.clientY
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!orbitRef.current.dragging) return
      const dx = event.clientX - orbitRef.current.lastX
      const dy = event.clientY - orbitRef.current.lastY

      orbitRef.current.azimuth -= dx * 0.005
      orbitRef.current.polar -= dy * 0.005

      orbitRef.current.polar = Math.min(Math.max(0.35, orbitRef.current.polar), 1.35)

      orbitRef.current.lastX = event.clientX
      orbitRef.current.lastY = event.clientY
    }

    const onPointerUp = () => {
      orbitRef.current.dragging = false
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      orbitRef.current.distance = Math.min(
        Math.max(PLANET_RADIUS * 1.2, orbitRef.current.distance + event.deltaY * 0.01),
        PLANET_RADIUS * 6,
      )
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('wheel', onWheel)
    }
  }, [mode])

  useFrame((_state, delta) => {
    const { position, forward, normal } = stateRef.current

    if (mode === 'first') {
      temp.offset.copy(normal).multiplyScalar(0.35)
      temp.target.copy(position).addScaledVector(forward, 2)
      camera.position.lerp(temp.offset.add(position), 0.35)
      camera.lookAt(temp.target)
      return
    }

    // Isométrico: câmera fixa em um ângulo alto, olhando para o player
    temp.target.copy(position)
    temp.offset.setFromSphericalCoords(
      orbitRef.current.distance,
      orbitRef.current.polar,
      orbitRef.current.azimuth,
    )
    camera.position.lerp(temp.offset.add(temp.target), 0.12)
    camera.lookAt(temp.target)
    camera.up.copy(temp.up)
  })

  return null
}

function TerrainVoxels({ terrain, setTerrain }: { terrain: TerrainData; setTerrain: (t: TerrainData) => void }) {
  const basePath = '/SSBJr.geosimulator/'

  const dirtColor = useTexture(basePath + 'textures/Ground086_1K-JPG_Color.jpg')
  const dirtNormal = useTexture(basePath + 'textures/Ground086_1K-JPG_NormalGL.jpg')
  const dirtRoughness = useTexture(basePath + 'textures/Ground086_1K-JPG_Roughness.jpg')

  const rockColor = useTexture(basePath + 'textures/Rock058_1K-JPG_Color.jpg')
  const rockNormal = useTexture(basePath + 'textures/Rock058_1K-JPG_NormalGL.jpg')
  const rockRoughness = useTexture(basePath + 'textures/Rock058_1K-JPG_Roughness.jpg')

  const removeVoxel = (index: number) => {
    const newPositions = terrain.positions.filter((_, i) => i !== index)
    const newColors = terrain.colors.filter((_, i) => i !== index)
    setTerrain({ ...terrain, positions: newPositions, colors: newColors })
  }

  return (
    <group>
      {terrain.positions.map((position, index) => {
        const color = terrain.colors[index]
        const isDirt = color.equals(COLORS.dirt)
        const isRock = color.equals(COLORS.rock)
        return (
          <mesh key={index} position={position} onClick={() => removeVoxel(index)}>
            <boxGeometry args={[VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE]} />
            <meshStandardMaterial
              map={isDirt ? dirtColor : isRock ? rockColor : undefined}
              normalMap={isDirt ? dirtNormal : isRock ? rockNormal : undefined}
              roughnessMap={isDirt ? dirtRoughness : isRock ? rockRoughness : undefined}
              color={color}
              roughness={1}
              metalness={0}
            />
          </mesh>
        )
      })}
    </group>
  )
}

export default function GeoScene({ seed, cameraMode }: GeoSceneProps) {
  const playerStateRef = useRef<PlayerState>({
    position: new Vector3(0, 10, 0),
    forward: new Vector3(0, 0, -1),
    normal: new Vector3(0, 1, 0),
  })

  const [terrain, setTerrain] = useState(() => generatePlanet(seed))

  const sunPosition = [50, 20, 30] as const

  return (
    <Canvas className="canvas" camera={{ position: [0, 12, 0], fov: 62 }}>
      <color attach="background" args={['#05070c']} />
      <ambientLight intensity={1.35} />
      <hemisphereLight intensity={0.85} color="#e6f1ff" groundColor="#24324f" />
      <directionalLight position={sunPosition} intensity={1.6} />
      <TerrainVoxels terrain={terrain} setTerrain={setTerrain} />
      <Player stateRef={playerStateRef} terrain={terrain} />
      <CameraRig mode={cameraMode} stateRef={playerStateRef} />
    </Canvas>
  )
}
