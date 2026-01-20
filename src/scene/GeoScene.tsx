import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
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
const VOXEL_SIZE = 0.45
const LAT_STEPS = 28
const LON_STEPS = 52
const EARTH_AXIAL_TILT = (23.44 * Math.PI) / 180
const STEP_MAX = VOXEL_SIZE * 2.6
const DECAL_IGNORE = VOXEL_SIZE * 0.6
const PLAYER_RADIUS = 0.16
const PLAYER_HEIGHT = 0.6
const GRAVITY_SPRING = 10
const GRAVITY_DAMP = 4.5

const COLORS = {
  ocean: new Color('#1c4fa1'),
  rock: new Color('#7c6f64'),
  lava: new Color('#ff5a3c'),
  sand: new Color('#c2a46b'),
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
  const heights = new Array<number>(LAT_STEPS * LON_STEPS).fill(1)

  for (let lat = 0; lat < LAT_STEPS; lat += 1) {
    const phi = (lat / (LAT_STEPS - 1)) * Math.PI

    for (let lon = 0; lon < LON_STEPS; lon += 1) {
      const theta = (lon / LON_STEPS) * Math.PI * 2
      const noise = seededNoise(seed, lat, lon)

      const normal = new Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      ).normalize()

      const isOcean = noise < 0.3
      const isLava = noise > 0.93
      const height = isOcean ? 1 : Math.floor(1 + noise * 3)
      heights[lat * LON_STEPS + lon] = height

      const baseColor = isOcean
        ? COLORS.ocean
        : isLava
          ? COLORS.lava
          : noise > 0.75
            ? COLORS.sand
            : COLORS.rock

      for (let h = 0; h < height; h += 1) {
        const position = normal.clone().multiplyScalar(PLANET_RADIUS + h * VOXEL_SIZE)
        positions.push(position)
        colors.push(baseColor.clone())
      }
    }
  }

  return { positions, colors, heights }
}

function PlanetVoxels({ terrain }: { terrain: TerrainData }) {
  const instancedRef = useRef<InstancedMesh>(null!)
  const { positions, colors } = terrain

  useEffect(() => {
    const mesh = instancedRef.current
    const matrix = new Matrix4()

    positions.forEach((position, index) => {
      matrix.setPosition(position)
      mesh.setMatrixAt(index, matrix)
      mesh.setColorAt(index, colors[index])
    })

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true
    }
  }, [positions, colors])

  return (
    <instancedMesh ref={instancedRef} args={[undefined, undefined, positions.length]}>
      <boxGeometry args={[VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE]} />
      <meshStandardMaterial vertexColors roughness={0.9} metalness={0.05} />
    </instancedMesh>
  )
}

function useKeyboard() {
  const keysRef = useRef({
    forward: false,
    back: false,
    left: false,
    right: false,
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
          keysRef.current.forward = true
          break
        case 'KeyS':
        case 'ArrowDown':
          keysRef.current.back = true
          break
        case 'KeyA':
        case 'ArrowLeft':
          keysRef.current.left = true
          break
        case 'KeyD':
        case 'ArrowRight':
          keysRef.current.right = true
          break
        default:
          break
      }
    }

    const onKeyUp = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
          keysRef.current.forward = false
          break
        case 'KeyS':
        case 'ArrowDown':
          keysRef.current.back = false
          break
        case 'KeyA':
        case 'ArrowLeft':
          keysRef.current.left = false
          break
        case 'KeyD':
        case 'ArrowRight':
          keysRef.current.right = false
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

function sampleSurfaceRadius(normal: Vector3, heights: number[]) {
  const phi = Math.acos(Math.min(Math.max(normal.y, -1), 1))
  const theta = Math.atan2(normal.z, normal.x)

  const latF = (phi / Math.PI) * (LAT_STEPS - 1)
  const lonF = ((theta + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * LON_STEPS

  const lat0 = Math.floor(latF)
  const lon0 = Math.floor(lonF) % LON_STEPS
  const lat1 = Math.min(lat0 + 1, LAT_STEPS - 1)
  const lon1 = (lon0 + 1) % LON_STEPS

  const t = latF - lat0
  const u = lonF - lon0

  const h00 = heights[lat0 * LON_STEPS + lon0] ?? 1
  const h10 = heights[lat1 * LON_STEPS + lon0] ?? 1
  const h01 = heights[lat0 * LON_STEPS + lon1] ?? 1
  const h11 = heights[lat1 * LON_STEPS + lon1] ?? 1

  const h0 = h00 * (1 - t) + h10 * t
  const h1 = h01 * (1 - t) + h11 * t
  const height = h0 * (1 - u) + h1 * u

  return PLANET_RADIUS + height * VOXEL_SIZE
}

type PlayerState = {
  position: Vector3
  forward: Vector3
  normal: Vector3
}

function Player({
  seed,
  stateRef,
  terrain,
}: {
  seed: number
  stateRef: React.MutableRefObject<PlayerState>
  terrain: TerrainData
}) {
  const meshRef = useRef<Mesh>(null!)
  const helperMeshRef = useRef<Mesh>(null!)
  const keys = useKeyboard()

  const positionRef = useRef<Vector3>(stateRef.current.position)
  const forwardRef = useRef<Vector3>(stateRef.current.forward)
  const radialRef = useRef<number>(PLANET_RADIUS)
  const radialVelocityRef = useRef<number>(0)

  const temps = useMemo(
    () => ({
      up: new Vector3(0, 1, 0),
      normal: new Vector3(),
      east: new Vector3(),
      north: new Vector3(),
      move: new Vector3(),
      camPos: new Vector3(),
      lookAt: new Vector3(),
      offset: new Vector3(),
    }),
    [],
  )

  useEffect(() => {
    const rng = mulberry32(seed)
    const theta = rng() * Math.PI * 2
    const phi = rng() * Math.PI
    positionRef.current.set(
      PLANET_RADIUS * Math.sin(phi) * Math.cos(theta),
      PLANET_RADIUS * Math.cos(phi),
      PLANET_RADIUS * Math.sin(phi) * Math.sin(theta),
    )

    temps.normal.copy(positionRef.current).normalize()
    temps.east.crossVectors(temps.up, temps.normal).normalize()
    temps.north.crossVectors(temps.normal, temps.east).normalize()
    forwardRef.current.copy(temps.north)
    stateRef.current.normal.copy(temps.normal)

    const surfaceRadius = sampleSurfaceRadius(temps.normal, terrain.heights)
    radialRef.current = surfaceRadius
    radialVelocityRef.current = 0
    positionRef.current.copy(temps.normal).multiplyScalar(surfaceRadius)
  }, [seed, temps])

  // helper cylinder is rendered as a child mesh in JSX below

  useFrame((_state, delta) => {
    temps.normal.copy(positionRef.current).normalize()
    temps.east.crossVectors(temps.up, temps.normal).normalize()
    temps.north.crossVectors(temps.normal, temps.east).normalize()

    const inputX = (keys.current.right ? 1 : 0) - (keys.current.left ? 1 : 0)
    const inputY = (keys.current.forward ? 1 : 0) - (keys.current.back ? 1 : 0)

    if (inputX !== 0 || inputY !== 0) {
      temps.move
        .set(0, 0, 0)
        .addScaledVector(temps.north, inputY)
        .addScaledVector(temps.east, inputX)
        .normalize()

      // Projetar movimento na tangente da superfície para deslizar
      const moveWorld = temps.move.clone()
      const nDot = moveWorld.dot(temps.normal)
      moveWorld.addScaledVector(temps.normal, -nDot).normalize()

      const candidate = positionRef.current.clone().addScaledVector(moveWorld, 2.1 * delta)
      candidate.normalize()

      // Amostrar ao redor do colisor cilíndrico para simular um cilindro que 'anda sobre' decalques
      const samples = 8
      let currentMax = -Infinity
      let candidateMax = -Infinity

      for (let i = 0; i < samples; i++) {
        const ang = (i / samples) * Math.PI * 2
        const offset = temps.east.clone().multiplyScalar(Math.cos(ang)).addScaledVector(temps.north, Math.sin(ang)).multiplyScalar(PLAYER_RADIUS)

        const samplePos = positionRef.current.clone().add(offset).normalize()
        const sampleCandPos = candidate.clone().add(offset).normalize()

        const sSurf = sampleSurfaceRadius(samplePos, terrain.heights)
        const cSurf = sampleSurfaceRadius(sampleCandPos, terrain.heights)

        if (sSurf > currentMax) currentMax = sSurf
        if (cSurf > candidateMax) candidateMax = cSurf
      }

      // Ignorar decalques / pequenas irregularidades
      if (candidateMax - currentMax <= DECAL_IGNORE) {
        candidateMax = currentMax
      }

      // Colisão lateral suave: impede apenas degraus muito altos
      if (candidateMax - currentMax <= STEP_MAX) {
        // ajustar posição para o raio apropriado
        positionRef.current.copy(candidate).multiplyScalar(candidateMax)
        forwardRef.current.copy(moveWorld)
      }
    }

    // Gravidade suave: converge para o raio da superfície sem “snap”
    const targetSurface = sampleSurfaceRadius(temps.normal, terrain.heights)
    const radial = radialRef.current
    const radialVelocity = radialVelocityRef.current
    const accel = (targetSurface - radial) * GRAVITY_SPRING - radialVelocity * GRAVITY_DAMP
    const nextVelocity = radialVelocity + accel * delta
    const nextRadial = radial + nextVelocity * delta

    radialRef.current = nextRadial
    radialVelocityRef.current = nextVelocity
    positionRef.current.copy(temps.normal).multiplyScalar(nextRadial)

    stateRef.current.position.copy(positionRef.current)
    stateRef.current.forward.copy(forwardRef.current)
    stateRef.current.normal.copy(temps.normal)

    meshRef.current.position.copy(positionRef.current)
    temps.lookAt.copy(positionRef.current).addScaledVector(forwardRef.current, 2)
    meshRef.current.lookAt(temps.lookAt)
  })

  return (
    <mesh ref={meshRef}>
      <capsuleGeometry args={[PLAYER_RADIUS, 0.3, 6, 12]} />
      <meshStandardMaterial color="#e9f2ff" roughness={0.4} />
      <mesh ref={helperMeshRef} position={[0, -PLAYER_HEIGHT / 2 + 0.02, 0]}>
        <cylinderGeometry args={[PLAYER_RADIUS, PLAYER_RADIUS, PLAYER_HEIGHT, 16]} />
        <meshBasicMaterial color="#ff6b6b" wireframe={true} />
      </mesh>
    </mesh>
  )
}

function CameraRig({ mode, stateRef }: { mode: GeoSceneProps['cameraMode']; stateRef: React.MutableRefObject<PlayerState> }) {
  const { camera } = useThree()
  const orbitRef = useRef({
    azimuth: Math.PI / 4,
    polar: Math.PI / 3,
    distance: PLANET_RADIUS * 2.4,
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

export default function GeoScene({ seed, cameraMode }: GeoSceneProps) {
  const playerStateRef = useRef<PlayerState>({
    position: new Vector3(0, PLANET_RADIUS, 0),
    forward: new Vector3(0, 0, -1),
    normal: new Vector3(0, 1, 0),
  })

  const terrain = useMemo(() => generatePlanet(seed), [seed])

  const sunPosition = useMemo(() => {
    const distance = PLANET_RADIUS * 3
    const y = Math.sin(EARTH_AXIAL_TILT) * distance
    const z = Math.cos(EARTH_AXIAL_TILT) * distance
    return [distance, y, z] as const
  }, [])

  return (
    <Canvas className="canvas" camera={{ position: [0, PLANET_RADIUS + 1.6, 0], fov: 62 }}>
      <color attach="background" args={['#05070c']} />
      <ambientLight intensity={1.35} />
      <hemisphereLight intensity={0.85} color="#e6f1ff" groundColor="#24324f" />
      <directionalLight position={sunPosition} intensity={1.6} />
      <PlanetVoxels terrain={terrain} />
      <Player seed={seed} stateRef={playerStateRef} terrain={terrain} />
      <CameraRig mode={cameraMode} stateRef={playerStateRef} />
    </Canvas>
  )
}
