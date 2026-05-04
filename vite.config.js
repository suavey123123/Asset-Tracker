import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  build: {
    rollupOptions: {
      output: {
        // your existing rollup options here (if any)
      }
    }
  },

  // Add this:
  esbuild: {
    // This helps avoid eval in some cases
    legalComments: 'none',
  }
})