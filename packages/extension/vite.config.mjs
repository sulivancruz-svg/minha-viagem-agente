import { defineConfig, build as viteBuild } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'node:path'
import { copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const rootDir = dirname(fileURLToPath(import.meta.url))
const alias = { '@shared': resolve(rootDir, 'src/shared') }

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'extension-dual-build',
      async closeBundle() {
        // Build 2: content script single-file (sem imports/chunks)
        await viteBuild({
          configFile: false,
          plugins: [react()],
          resolve: { alias },
          build: {
            outDir: 'dist',
            emptyOutDir: false,
            rollupOptions: {
              input: resolve(rootDir, 'src/content/index.tsx'),
              output: {
                format: 'iife',
                inlineDynamicImports: true,
                entryFileNames: 'content.js',
                chunkFileNames: 'content-[hash].js',
                assetFileNames: 'assets/[name]-[hash][extname]',
              },
            },
          },
        })

        // Copia manifest e icones para dist
        mkdirSync(resolve(rootDir, 'dist/icons'), { recursive: true })
        copyFileSync(resolve(rootDir, 'manifest.json'), resolve(rootDir, 'dist/manifest.json'))
        for (const size of ['16', '48', '128']) {
          const src = resolve(rootDir, `icons/icon${size}.png`)
          if (existsSync(src)) {
            copyFileSync(src, resolve(rootDir, `dist/icons/icon${size}.png`))
          }
        }
      },
    },
  ],
  resolve: { alias },
  // Build 1: background + popup (ESM com chunks)
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(rootDir, 'src/background/index.ts'),
        popup: resolve(rootDir, 'src/popup/index.html'),
      },
      output: {
        format: 'es',
        entryFileNames: chunk =>
          chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
})
