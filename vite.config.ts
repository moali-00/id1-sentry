import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { frameHandler, registryHandler, streamStatusHandler } from './api/_lib/handlers.ts'
import { toNodeHandler } from './api/_lib/node-adapter.ts'

/**
 * Mount the camera endpoints on the dev server.
 *
 * In production `api/*.ts` are serverless functions the host routes to. Vite's dev
 * server knows nothing about that convention, so without this the camera layer is
 * the one feature that only works in a deployed build — and the frame proxy is
 * exactly the thing you need to be able to poke at locally.
 *
 * The handlers are the same ones the deployed functions export. This is a routing
 * shim and nothing else; there is no second implementation to keep in step.
 */
function cctvDevApi(): Plugin {
  const routes: Record<string, ReturnType<typeof toNodeHandler>> = {
    '/api/cctv': toNodeHandler(registryHandler),
    '/api/cctv-frame': toNodeHandler(frameHandler),
    '/api/cctv-stream-status': toNodeHandler(streamStatusHandler),
  }

  return {
    name: 'sentry:cctv-dev-api',
    // Dev only. `vite preview` serves the built bundle and has no functions either,
    // but pretending otherwise there would hide that the real host must provide them.
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0]
        const handler = path ? routes[path] : undefined
        if (!handler) {
          next()
          return
        }
        void handler(req, res)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), cctvDevApi()],
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
    // MapLibre's own chunk lands around 1,070 kB raw. It is expected to be the
    // largest thing in the build and is loaded once, so it is not worth a
    // warning on every build.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Heavy, rarely-changing third-party code goes into cacheable vendor
        // chunks so the app chunk stays small across deploys. MapLibre is by far
        // the biggest dependency here — an order of magnitude past everything
        // else — so it gets its own chunk and its own cache lifetime.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('maplibre-gl') || id.includes('/@maplibre/')) return 'vendor-maplibre'
          if (id.includes('react-router') || id.includes('/@remix-run/')) return 'vendor-router'
          if (id.includes('@reduxjs') || id.includes('react-redux') || id.includes('/immer/')) {
            return 'vendor-redux'
          }
          if (id.includes('react-dom') || id.includes('/scheduler/') || id.includes('/react/')) {
            return 'vendor-react'
          }
          /*
           * hls.js must be its own chunk, and this line is what makes its dynamic
           * import in `camera_detail.tsx` mean anything.
           *
           * Naming a module here **overrides Rollup's code splitting**: without this
           * branch it fell into the shared `vendor` chunk, which is loaded on first
           * paint — so every visitor downloaded ~400 kB of video player whether or
           * not they ever opened a camera, and the `import()` bought nothing. Only a
           * handful of cameras in the whole registry are HLS.
           */
          if (id.includes('hls.js')) return 'vendor-hls'
          return 'vendor'
        },
      },
    },
  },
  server: { port: 5175 },
  preview: { port: 4175 },
})
