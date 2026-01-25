import RAPIER from '@dimforge/rapier3d-compat'

let world: any = null
let pool: Array<{ body: any; collider: any; active: boolean }> = []
let poolNext = 0
const POOL_SIZE = 12
let stepping = false

async function init() {
  if (!RAPIER) return
  try {
    if (RAPIER.init) await RAPIER.init()
  } catch (e) {}
  world = new (RAPIER as any).World({ x: 0, y: -9.81, z: 0 })
  pool = []
  for (let i = 0; i < POOL_SIZE; i++) {
    const rb = world.createRigidBody((RAPIER as any).RigidBodyDesc.dynamic().setTranslation(0, -1000, 0))
    const collider = world.createCollider((RAPIER as any).ColliderDesc.cuboid(0.1, 0.1, 0.1), rb)
    pool.push({ body: rb, collider, active: false })
  }
  startLoop()
}

function startLoop() {
  if (stepping) return
  stepping = true
  const stepMs = 33 // ~30Hz
  setInterval(() => {
    if (!world) return
    world.timestep = stepMs / 1000
    world.step()
    const out: Array<{ x: number; y: number; z: number }> = []
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i]
      if (!p.active) continue
      const t = p.body.translation()
      out.push({ x: t.x, y: t.y, z: t.z })
      // simple deactivation when far below
      if (t.y < -20) p.active = false
    }
    if (out.length > 0) postMessage({ type: 'update', positions: out })
  }, stepMs)
}

function spawnPositions(positions: Array<{ x: number; y: number; z: number }>) {
  if (!world) return
  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i]
    const idx = poolNext % pool.length
    poolNext = (poolNext + 1) % pool.length
    const item = pool[idx]
    item.active = true
    try {
      item.body.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true)
      item.body.setLinvel({ x: (Math.random() - 0.5) * 1.2, y: 1 + Math.random() * 1.2, z: (Math.random() - 0.5) * 1.2 }, true)
      item.body.setAngvel({ x: (Math.random() - 0.5) * 1.5, y: (Math.random() - 0.5) * 1.5, z: (Math.random() - 0.5) * 1.5 }, true)
    } catch (e) {
      // ignore
    }
  }
}

onmessage = async (e) => {
  const msg = e.data
  if (msg.type === 'init') {
    await init()
    postMessage({ type: 'inited' })
  } else if (msg.type === 'spawn') {
    spawnPositions(msg.positions || [])
  }
}
