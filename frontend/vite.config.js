import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Libraries change rarely, so keep them in their own long-cached file.
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'axios']
        }
      }
    }
  },
  server: {
    port: 3001,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '^/[^/]+/api(?:/|$)': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
