import {defineConfig, mergeConfig} from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Leave CSS module class names as written, so `classes.drawing` and friends
    // are the plain names the tests assert on.
    css: {
      modules: {classNameStrategy: 'non-scoped'}
    }
  }
}))
