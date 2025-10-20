import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/auth': 'http://server:3000',
      '/game': 'http://server:3000',
      '/events': 'http://server:3000',
      '/certificate': 'http://server:3000',
      '/api': 'http://server:3000',
      '/transactions': 'http://server:3000'
    }
  }
})
