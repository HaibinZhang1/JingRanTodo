import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'

export default defineConfig({
    plugins: [
        react(),
        electron([
            {
                // Main process entry
                entry: 'src/main/index.ts',
                onstart(options) {
                    options.startup()
                },
                vite: {
                    build: {
                        outDir: 'dist-electron/main',
                        emptyOutDir: true,
                        rollupOptions: {
                            external: ['sql.js', 'koffi']
                        }
                    }
                }
            },
            {
                // Preload scripts
                entry: 'src/preload/index.ts',
                onstart(options) {
                    options.reload()
                },
                vite: {
                    build: {
                        outDir: 'dist-electron/preload',
                        emptyOutDir: true
                    }
                }
            }
        ]),
        renderer()
    ],
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src/renderer'),
            '@main': resolve(__dirname, 'src/main')
        }
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true
    }
})
