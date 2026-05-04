import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // ...
      }
    }
  },
  // Add this:
  esbuild: {
    // This helps avoid eval in some cases
    legalComments: 'none',
  }
})