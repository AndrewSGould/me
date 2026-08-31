import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  build: {
    modulePreload: { polyfill: false },
    sourcemap: false,
    target: 'es2022',
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, 'index.html'),
        card: resolve(import.meta.dirname, 'me', 'index.html'),
        notFound: resolve(import.meta.dirname, '404.html'),
      },
    },
  },
})
