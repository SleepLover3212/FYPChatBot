import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts:
    [
      'qfwu7vp0zhos.share.zrok.io', // frontend
      
      '2uznndx0aq3c.share.zrok.io' // backend
    ]
  }
})
