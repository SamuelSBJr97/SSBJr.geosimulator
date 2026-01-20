import { Suspense, lazy, useState } from 'react'
import './App.css'

const GeoScene = lazy(() => import('./scene/GeoScene'))

export default function App() {
  const [isRunning, setIsRunning] = useState(false)

  return (
    <div className="app">
      <header className="header">
        <h1>SSBJr • GeoSimulator</h1>
        <p>Base React + Three.js (R3F). Próximo passo: voxels, rochas, lava, oceano.</p>
      </header>

      <main className="stage">
        {!isRunning ? (
          <div className="starter">
            <p className="starterTitle">Simulação pronta para iniciar</p>
            <p className="starterText">
              Clique para carregar o cenário 3D (lazy-load). Isso deixa o bundle inicial menor.
            </p>
            <button className="button" onClick={() => setIsRunning(true)}>
              Iniciar simulação
            </button>
          </div>
        ) : (
          <Suspense fallback={<div className="loading">Carregando cenário 3D…</div>}>
            <GeoScene />
            <div className="hint">Arraste para orbitar • Scroll para zoom</div>
          </Suspense>
        )}
      </main>
    </div>
  )
}
