import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: true, drop_debugger: true, passes: 2 },
      format: { comments: false },
    },
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Heavy, rarely-changing third-party code goes into cacheable vendor
        // chunks so the app chunk stays small across deploys. Leaflet is the
        // single biggest dependency here, so it gets its own chunk.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('/leaflet/')) return 'vendor-leaflet'
          if (id.includes('react-router') || id.includes('/@remix-run/')) return 'vendor-router'
          if (id.includes('@reduxjs') || id.includes('react-redux') || id.includes('/immer/')) {
            return 'vendor-redux'
          }
          if (id.includes('react-dom') || id.includes('/scheduler/') || id.includes('/react/')) {
            return 'vendor-react'
          }
          return 'vendor'
        },
      },
    },
  },
  server: { port: 5175 },
  preview: { port: 4175 },
})
