import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' => caminhos relativos para funcionar em subdominio servido via SFTP
export default defineConfig({
  plugins: [react()],
  base: './',
})
