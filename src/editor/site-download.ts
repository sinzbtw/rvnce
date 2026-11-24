import { strToU8, zip, type Zippable } from 'fflate'
import manropeCss from '@fontsource-variable/manrope/index.css?raw'
import manropeLicense from '@fontsource-variable/manrope/LICENSE?raw'
import sansCss from '@fontsource-variable/source-sans-3/index.css?raw'
import sansLicense from '@fontsource-variable/source-sans-3/LICENSE?raw'
import serifCss from '@fontsource-variable/source-serif-4/index.css?raw'
import serifLicense from '@fontsource-variable/source-serif-4/LICENSE?raw'
import css from '../public/profile.css?raw'
import motionScript from '../public/background-motion.js?raw'
import { fontFiles, siteFiles } from '../export/site'
import type { ProfileDocument } from '../profile/document'
import { publishedAvatar, publishedFavicon } from './files'

const fontUrls = import.meta.glob<string>(
  '/node_modules/@fontsource-variable/{manrope,source-sans-3,source-serif-4}/files/*-wght-normal.woff2',
  { import: 'default', query: '?url&no-inline', eager: true },
)
const fontAssets = {
  manrope: [manropeCss, manropeLicense],
  'source-sans-3': [sansCss, sansLicense],
  'source-serif-4': [serifCss, serifLicense],
} as const

async function asset(
  url: string | undefined,
): Promise<Uint8Array<ArrayBuffer>> {
  if (url) {
    try {
      const response = await fetch(url)
      if (response.ok) return new Uint8Array(await response.arrayBuffer())
    } catch {
      // Report HTTP and connection failures consistently.
    }
  }
  throw new Error('An export asset could not load. Try again.')
}

export async function zipProfile(doc: ProfileDocument): Promise<Blob> {
  const family = doc.appearance.typography.font
  const [fontCss, fontLicense] = fontAssets[family]
  const [fonts, avatar, favicon] = await Promise.all([
    Promise.all(
      fontFiles(fontCss).map(
        async (name) =>
          [
            name,
            await asset(
              fontUrls[
                '/node_modules/@fontsource-variable/' +
                  family +
                  '/files/' +
                  name
              ],
            ),
          ] as const,
      ),
    ),
    doc.profile.avatar ? publishedAvatar(doc.profile.avatar) : undefined,
    doc.branding.favicon ? publishedFavicon(doc.branding.favicon) : undefined,
  ])
  const files = siteFiles(doc, {
    css,
    motionScript,
    fontCss,
    fonts: Object.fromEntries(fonts),
    fontLicense: strToU8(fontLicense),
    avatar,
    favicon,
  })
  const entries: Zippable = {}
  for (const [name, contents] of Object.entries(files)) {
    const bytes = typeof contents === 'string' ? strToU8(contents) : contents
    entries[name] = /\.(?:png|jpg|gif|mp4|woff2)$/u.test(name)
      ? [bytes, { level: 0 }]
      : bytes
  }
  return new Promise((resolve, reject) => {
    zip(entries, (error, bytes) => {
      if (error) reject(error)
      else resolve(new Blob([bytes], { type: 'application/zip' }))
    })
  })
}
