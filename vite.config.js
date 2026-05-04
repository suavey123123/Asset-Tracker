import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  // Add any other settings you had (build, server, etc.)
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined, // optional
      }
    }
  }
})