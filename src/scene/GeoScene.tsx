import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Mesh } from 'three'

function SpinningVoxel() {
  const meshRef = useRef<Mesh>(null!)

  useFrame((_state: unknown, delta: number) => {
    meshRef.current.rotation.y += delta * 0.7
    meshRef.current.rotation.x += delta * 0.25
  })

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#6cc4ff" roughness={0.65} metalness={0.05} />
    </mesh>
  )
}

export default function GeoScene() {
  return (
    <Canvas className="canvas" camera={{ position: [2.5, 2, 2.5], fov: 55 }}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 5, 2]} intensity={1.1} />
      <SpinningVoxel />
      <OrbitControls enableDamping />
    </Canvas>
  )
}
