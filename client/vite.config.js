import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  appType: 'spa',       // 所有 404 路径回退到 index.html
  server: {
    host: '0.0.0.0',   // 默认外网可访问
    port: 5173,
    strictPort: true,
  }
})
