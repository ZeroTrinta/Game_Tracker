import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Troque 'gametracker-ml' pelo nome exato do seu repositório no GitHub
export default defineConfig({
  plugins: [react()],
  base: '/Game_Tracker/',
})
