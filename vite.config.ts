import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

export default defineConfig({
  // GitHub Pages serves project sites from /<repository>/.
  // Keep local development and other deployments rooted at /.
  base: process.env.GITHUB_ACTIONS === 'true' ? '/farway/' : '/',
  plugins: [uni()],
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['legacy-js-api']
      }
    }
  },
  server: {
    port: 5180,
    strictPort: true
  }
})
