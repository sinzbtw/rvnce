import type { FullConfig } from '@playwright/test'
import { preview } from 'vite'

export default async function startPreview(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL
  if (!baseURL) throw new Error('The browser tests require a preview URL.')
  const url = new URL(baseURL)
  const server = await preview({
    preview: {
      host: url.hostname,
      port: Number(url.port),
      strictPort: true,
    },
  })
  return () => server.close()
}
