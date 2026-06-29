import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom']
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return;
          }
          if (id.includes('@knaw-huc/panoptes-react-blocks')) {
            return 'panoptes-blocks';
          }
          if (id.includes('@knaw-huc/panoptes-react')) {
            return 'panoptes';
          }
          if (id.includes('react-aria')
              || id.includes('@react-aria')
              || id.includes('@react-stately')) {
            return 'react-aria';
          }
          if (id.includes('/react/')
              || id.includes('/react-dom/')
              || id.includes('/scheduler/')) {
            return 'react';
          }
        }
      }
    }
  }
})
