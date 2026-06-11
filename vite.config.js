import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Use a relative base so assets load correctly when served from Vercel
export default defineConfig({
	base: './',
	plugins: [react()],
})
