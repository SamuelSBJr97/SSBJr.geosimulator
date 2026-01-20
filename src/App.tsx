import { Suspense, lazy, useState } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'
import type { GeoSceneProps } from './scene/GeoScene'
import './App.css'

const GeoScene = lazy(() => import('./scene/GeoScene')) as LazyExoticComponent<
  ComponentType<GeoSceneProps>
>

export default function App() {
  const [isRunning, setIsRunning] = useState(false)
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1_000_000_000))
  const [cameraMode, setCameraMode] = useState<'first' | 'iso'>('first')

  return (
    <div className="app">
      <header className="header">
        <div className="headerRow">
          <div>
            <h1>SSBJr • GeoSimulator</h1>
            <p>Base React + Three.js (R3F). Próximo passo: voxels, rochas, lava, oceano.</p>
          </div>
          <div className="cameraToggle">
            <button
              className={`chip ${cameraMode === 'first' ? 'active' : ''}`}
              onClick={() => setCameraMode('first')}
            >
              1ª pessoa
            </button>
            <button
              className={`chip ${cameraMode === 'iso' ? 'active' : ''}`}
              onClick={() => setCameraMode('iso')}
            >
              Isométrica
            </button>
          </div>
        </div>
      </header>

      <main className="stage">
        {!isRunning ? (
          <div className="starter">
            <p className="starterTitle">Simulação pronta para iniciar</p>
            <p className="starterText">
              Clique para carregar o cenário 3D (lazy-load). Isso deixa o bundle inicial menor.
            </p>
            <button
              className="button"
              onClick={() => {
                setSeed(Math.floor(Math.random() * 1_000_000_000))
                setIsRunning(true)
              }}
            >
              Iniciar simulação
            </button>
          </div>
        ) : (
          <Suspense fallback={<div className="loading">Carregando cenário 3D…</div>}>
            <GeoScene seed={seed} cameraMode={cameraMode} />
            <div className="hint">
              WASD/Setas para andar • Câmera {cameraMode === 'first' ? '1ª pessoa' : 'isométrica'}
            </div>
          </Suspense>
        )}
      </main>
    </div>
  )
}
