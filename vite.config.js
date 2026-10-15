import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const port = Number.parseInt(process.env.PORT, 10) || 5173

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port,
  },
  preview: {
    host: '0.0.0.0',
    port,
  },
})
