/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_IS_VERCEL': JSON.stringify(!!process.env.VERCEL),
  },
  test: {
    globals: true,
  },
})
