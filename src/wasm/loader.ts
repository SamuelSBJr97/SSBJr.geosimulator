export type WasmModuleExports = {
  // example signature: compute interaction intensity between two points
  compute_interaction?: (ax: number, ay: number, az: number, bx: number, by: number, bz: number) => number
}

let wasmInstance: WasmModuleExports | null = null

export async function loadWasm(basePath = '/') {
  if (wasmInstance) return wasmInstance
  const wasmUrl = basePath + 'wasm/interaction.wasm'
  try {
    if ('instantiateStreaming' in WebAssembly) {
      const resp = await fetch(wasmUrl)
      const result = await WebAssembly.instantiateStreaming(resp, {})
      // @ts-ignore
      wasmInstance = result.instance.exports as WasmModuleExports
    } else {
      const bytes = await fetch(wasmUrl).then((r) => r.arrayBuffer())
      const result = await WebAssembly.instantiate(bytes, {})
      // @ts-ignore
      wasmInstance = result.instance.exports as WasmModuleExports
    }
    return wasmInstance
  } catch (e) {
    console.warn('WASM module not found or failed to load, falling back to JS. Error:', e)
    // Provide JS fallback implementation
    wasmInstance = {
      compute_interaction: (ax, ay, az, bx, by, bz) => {
        const dx = ax - bx
        const dy = ay - by
        const dz = az - bz
        const d2 = dx * dx + dy * dy + dz * dz
        return 1 / (1 + Math.sqrt(d2))
      },
    }
    return wasmInstance
  }
}
