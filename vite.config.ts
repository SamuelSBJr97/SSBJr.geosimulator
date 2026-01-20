import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serve o site em um sub-path (/<repo>/). Base relativa funciona bem.
  base: './',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    // Three.js tende a gerar chunks grandes; aumentamos o limite para evitar warning “ruidoso” no CI.
    chunkSizeWarningLimit: 1200,
  },
})
