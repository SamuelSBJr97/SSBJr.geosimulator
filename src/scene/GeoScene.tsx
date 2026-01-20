import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, Matrix4, Vector3 } from 'three'
import type { InstancedMesh, Mesh } from 'three'

export type GeoSceneProps = {
  seed: number
  cameraMode: 'first' | 'iso'
}

const PLANET_RADIUS = 4.8
const VOXEL_SIZE = 0.45
const LAT_STEPS = 28
const LON_STEPS = 52

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

function generatePlanet(seed: number) {
  const positions: Vector3[] = []
  const colors: Color[] = []

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

  return { positions, colors }
}

function PlanetVoxels({ seed }: { seed: number }) {
  const instancedRef = useRef<InstancedMesh>(null!)
  const { positions, colors } = useMemo(() => generatePlanet(seed), [seed])

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

type PlayerState = {
  position: Vector3
  forward: Vector3
  normal: Vector3
}

function Player({ seed, stateRef }: { seed: number; stateRef: React.MutableRefObject<PlayerState> }) {
  const meshRef = useRef<Mesh>(null!)
  const keys = useKeyboard()

  const positionRef = useRef<Vector3>(stateRef.current.position)
  const forwardRef = useRef<Vector3>(stateRef.current.forward)

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
  }, [seed, temps])

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

      positionRef.current.addScaledVector(temps.move, 2.1 * delta)
      positionRef.current.normalize().multiplyScalar(PLANET_RADIUS)
      forwardRef.current.copy(temps.move)
    }

    stateRef.current.position.copy(positionRef.current)
    stateRef.current.forward.copy(forwardRef.current)
    stateRef.current.normal.copy(temps.normal)

    meshRef.current.position.copy(positionRef.current)
    temps.lookAt.copy(positionRef.current).addScaledVector(forwardRef.current, 2)
    meshRef.current.lookAt(temps.lookAt)
  })

  return (
    <mesh ref={meshRef}>
      <capsuleGeometry args={[0.16, 0.3, 6, 12]} />
      <meshStandardMaterial color="#e9f2ff" roughness={0.4} />
    </mesh>
  )
}

function CameraRig({ mode, stateRef }: { mode: GeoSceneProps['cameraMode']; stateRef: React.MutableRefObject<PlayerState> }) {
  const { camera } = useThree()
  const temp = useMemo(
    () => ({
      offset: new Vector3(),
      target: new Vector3(),
      up: new Vector3(0, 1, 0),
      isoDir: new Vector3(1, 1, 1).normalize(),
    }),
    [],
  )

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
    temp.offset.copy(temp.isoDir).multiplyScalar(PLANET_RADIUS * 2.2)
    temp.target.copy(position)
    camera.position.lerp(temp.offset.add(position), 0.1)
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

  return (
    <Canvas className="canvas" camera={{ position: [0, PLANET_RADIUS + 1.6, 0], fov: 62 }}>
      <color attach="background" args={['#05070c']} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[8, 6, 4]} intensity={1.1} />
      <PlanetVoxels seed={seed} />
      <Player seed={seed} stateRef={playerStateRef} />
      <CameraRig mode={cameraMode} stateRef={playerStateRef} />
    </Canvas>
  )
}
