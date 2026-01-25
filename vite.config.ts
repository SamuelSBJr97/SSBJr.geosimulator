import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serve o site em um sub-path (/<repo>/). Base relativa funciona bem.
  base: './',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    // Targets modern browsers to allow WebAssembly + modern modules
    target: 'esnext',
    // Three.js tende a gerar chunks grandes; aumentamos o limite para evitar warning “ruidoso” no CI.
    chunkSizeWarningLimit: 1200,
    // Ensure .wasm files are preserved as assets and emitted
    rollupOptions: {
      output: {
        assetFileNames: (chunkInfo) => {
          if (chunkInfo && typeof chunkInfo.name === 'string' && chunkInfo.name.endsWith('.wasm')) return 'assets/wasm/[name]-[hash][extname]'
          return 'assets/[name]-[hash][extname]'
        },
      },
    },
  },
  // Treat .wasm as an asset during dev as well
  assetsInclude: ['**/*.wasm'],
})
