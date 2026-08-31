import { defineConfig } from 'vite'

export default defineConfig({
  base: '/me/',
  build: {
    modulePreload: { polyfill: false },
    sourcemap: false,
    target: 'es2022',
  },
})
