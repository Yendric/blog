import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import geny from '@yendric/geny/vite'

export default defineConfig({
  plugins: [react(), geny()],
  server: {
    // geny writes the configured dev server URL into its hot file
    strictPort: true,
  },
  build: {
    manifest: true,
    outDir: 'build',
    // geny copies public/ into build/ before running vite build.
    emptyOutDir: false,
    rollupOptions: {
      input: ['src/style.css', 'src/main.js'],
    },
  },
})
