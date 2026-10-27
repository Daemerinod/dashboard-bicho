import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// TBM supervisory backend. The dashboard fetches same-origin paths; Vite
// forwards them here, so the backend needs no CORS config.
//   /telemetry       GET   read side (useTelemetry)
//   /command         POST  normal commands (useCommand)
//   /api/plc/parada  POST  emergency stop (useCommand)
const TBM_BACKEND = 'http://localhost:8000'
const proxy = {
  '/telemetry': TBM_BACKEND,
  '/command': TBM_BACKEND,
  '/api/plc': TBM_BACKEND,
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy },
  preview: { proxy },
})
