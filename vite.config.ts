import { defineConfig } from 'vitest/config'

export default defineConfig(({ command }) => ({
  base: './',
  publicDir: command === 'serve' ? '.cache/dev-public' : false,
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  test: { include: ['tests/**/*.test.ts'] },
}))
