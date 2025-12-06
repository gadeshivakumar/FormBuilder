import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "https://form-builder-backend-u2m6.onrender.com",
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: "dist",
  }
})
