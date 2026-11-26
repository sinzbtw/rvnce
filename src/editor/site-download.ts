import { strToU8, zip, type Zippable } from 'fflate'
import manropeLicense from '@fontsource-variable/manrope/LICENSE?raw'
import interLicense from '@fontsource-variable/inter/LICENSE?raw'
import oswaldLicense from '@fontsource-variable/oswald/LICENSE?raw'
import monoLicense from '@fontsource-variable/roboto-mono/LICENSE?raw'
import sansLicense from '@fontsource-variable/source-sans-3/LICENSE?raw'
import serifLicense from '@fontsource-variable/source-serif-4/LICENSE?raw'
import fontAwesomeLicense from '/node_modules/@fortawesome/free-brands-svg-icons/LICENSE.txt?raw'
import lucideLicense from '/node_modules/lucide-preact/LICENSE?raw'
import css from '../public/profile.css?raw'
import { fontFiles, siteFiles } from '../export/site'
import { bundledFontCss, bundledFontUrl } from './bundled-fonts'
import type { ProfileDocument } from '../profile/document'
import { publishedAvatar, publishedFavicon } from './files'
import { runtimeAssets } from './runtime-assets'

const fontLicenses = {
  manrope: manropeLicense,
  inter: interLicense,
  oswald: oswaldLicense,
  'roboto-mono': monoLicense,
  'source-sans-3': sansLicense,
  'source-serif-4': serifLicense,
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
  const builtIn = typeof family === 'string' ? family : undefined
  const fontCss = builtIn ? bundledFontCss[builtIn] : ''
  const { background, effects } = doc.appearance
  const [fonts, avatar, favicon, motion, pointer, text] = await Promise.all([
    builtIn
      ? Promise.all(
          fontFiles(fontCss).map(
            async (name) =>
              [name, await asset(bundledFontUrl(builtIn, name))] as const,
          ),
        )
      : [],
    doc.profile.avatar ? publishedAvatar(doc.profile.avatar) : undefined,
    doc.branding.favicon ? publishedFavicon(doc.branding.favicon) : undefined,
    background.media && 'poster' in background.media
      ? asset(runtimeAssets.background)
      : undefined,
    effects.click.preset !== 'none' || effects.trail !== 'none'
      ? asset(runtimeAssets.pointer)
      : undefined,
    effects.nameMotion.preset !== 'none' ||
    doc.branding.tabTitle.preset !== 'none'
      ? asset(runtimeAssets.text)
      : undefined,
  ])
  const decoder = new TextDecoder()
  const files = siteFiles(doc, {
    css,
    motionScript: motion && decoder.decode(motion),
    pointerScript: pointer && decoder.decode(pointer),
    textScript: text && decoder.decode(text),
    fontCss,
    fonts: Object.fromEntries(fonts),
    fontLicense: builtIn ? strToU8(fontLicenses[builtIn]) : undefined,
    lucideLicense,
    fontAwesomeLicense,
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
