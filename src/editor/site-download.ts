import { strToU8, zipSync } from 'fflate'
import latinUrl from '@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2?url'
import cyrillicUrl from '@fontsource-variable/manrope/files/manrope-cyrillic-wght-normal.woff2?url'
import fontLicense from '@fontsource-variable/manrope/LICENSE?raw'
import css from '../public/profile.css?raw'
import { siteFiles } from '../export/site'
import type { ProfileDocument } from '../profile/document'

async function asset(url: string): Promise<Uint8Array<ArrayBuffer>> {
  const response = await fetch(url)
  if (!response.ok)
    throw new Error('An export asset could not load. Try again.')
  return new Uint8Array(await response.arrayBuffer())
}

export async function zipProfile(doc: ProfileDocument): Promise<Blob> {
  const [latinFont, cyrillicFont] = await Promise.all([
    asset(latinUrl),
    asset(cyrillicUrl),
  ])
  const files = siteFiles(doc, {
    css,
    latinFont,
    cyrillicFont,
    fontLicense: strToU8(fontLicense),
  })
  const zip = zipSync(
    Object.fromEntries(
      Object.entries(files).map(([name, contents]) => [
        name,
        typeof contents === 'string' ? strToU8(contents) : contents,
      ]),
    ),
  )
  return new Blob([Uint8Array.from(zip)], { type: 'application/zip' })
}
