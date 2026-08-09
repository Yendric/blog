import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// Reloads the browser when geny regenerates the build directory.
const genyReload = {
  name: 'geny-reload',
  configureServer(server) {
    const buildDir = resolve('build')
    server.watcher.add(buildDir)

    let timer
    server.watcher.on('all', (event, file) => {
      if (!file.startsWith(buildDir)) return
      if (event === 'unlink' || event === 'unlinkDir') return
      clearTimeout(timer)
      timer = setTimeout(() => server.ws.send({ type: 'full-reload' }), 150)
    })
  },
}

export default defineConfig({
  plugins: [genyReload],
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
