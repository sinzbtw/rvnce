import { strToU8, zipSync, type Zippable } from 'fflate'
import latinUrl from '@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2?url'
import cyrillicUrl from '@fontsource-variable/manrope/files/manrope-cyrillic-wght-normal.woff2?url'
import fontLicense from '@fontsource-variable/manrope/LICENSE?raw'
import css from '../public/profile.css?raw'
import { siteFiles } from '../export/site'
import type { ProfileDocument } from '../profile/document'
import { publishedAvatar } from './files'

async function asset(url: string): Promise<Uint8Array<ArrayBuffer>> {
  try {
    const response = await fetch(url)
    if (response.ok) return new Uint8Array(await response.arrayBuffer())
  } catch {
    // Report HTTP and connection failures consistently.
  }
  throw new Error('An export asset could not load. Try again.')
}

export async function zipProfile(doc: ProfileDocument): Promise<Blob> {
  const [latinFont, cyrillicFont, avatar] = await Promise.all([
    asset(latinUrl),
    asset(cyrillicUrl),
    doc.profile.avatar ? publishedAvatar(doc.profile.avatar) : undefined,
  ])
  const files = siteFiles(doc, {
    css,
    latinFont,
    cyrillicFont,
    fontLicense: strToU8(fontLicense),
    avatar,
  })
  const entries: Zippable = {}
  for (const [name, contents] of Object.entries(files)) {
    const bytes = typeof contents === 'string' ? strToU8(contents) : contents
    entries[name] = /\.(?:png|woff2)$/u.test(name)
      ? [bytes, { level: 0 }]
      : bytes
  }
  return new Blob([zipSync(entries)], { type: 'application/zip' })
}
