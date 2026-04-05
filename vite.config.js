import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'tab-stats':   ['./src/StatsTab.jsx'],
          'tab-dryroom': ['./src/DryRoomTab.jsx'],
          'tab-clones':  ['./src/ClonesTab.jsx'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
})
