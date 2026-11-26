import { bytesOf, decodeBase64 } from './media'
import { hasKeys } from './shape'

export const fontNames = [
  'manrope',
  'inter',
  'source-sans-3',
  'source-serif-4',
  'roboto-mono',
  'oswald',
] as const
export type FontName = (typeof fontNames)[number]
export type CustomFont =
  { source: 'file'; data: string } | { source: 'url'; url: string }
export type ProfileFont = FontName | CustomFont
export const customFontFamily = 'Rvnce Custom Font'
export const maxFontBytes = 1024 * 1024
export const fontFilePattern = /url\(\.\/files\/([a-z0-9-]+\.woff2)\)/gu
const invalidFile = 'Choose a valid WOFF2 font up to 1 MiB.'
const invalidUrl = 'Enter a direct HTTPS font URL.'

export function parseFontUrl(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length > 2048 ||
    !/^https:\/\//i.test(value.trim()) ||
    /[\s"\\]/u.test(value.trim())
  )
    throw new Error(invalidUrl)
  try {
    const url = new URL(value.trim())
    if (url.username || url.password) throw new Error(invalidUrl)
    url.hash = ''
    return url.href
  } catch {
    throw new Error(invalidUrl)
  }
}

export function checkFontHeader(
  buffer: ArrayBuffer,
  length = buffer.byteLength,
) {
  if (buffer.byteLength < 48 || length > maxFontBytes)
    throw new Error(invalidFile)
  const header = new DataView(buffer)
  const flavor = header.getUint32(4)
  const decompressedSize = header.getUint32(16)
  const compressedSize = header.getUint32(20)
  if (
    header.getUint32(0) !== 0x774f4632 ||
    (flavor !== 0x10000 && flavor !== 0x4f54544f) ||
    header.getUint32(8) !== length ||
    !header.getUint16(12) ||
    header.getUint16(14) !== 0 ||
    !decompressedSize ||
    decompressedSize > 8 * maxFontBytes ||
    !compressedSize ||
    compressedSize > length - 48
  )
    throw new Error(invalidFile)
}

export function parseFont(value: unknown): ProfileFont {
  const family = fontNames.find((name) => name === value)
  if (family) return family
  if (hasKeys(value, ['source', 'url']) && value.source === 'url')
    return { source: 'url', url: parseFontUrl(value.url) }
  if (hasKeys(value, ['source', 'data']) && value.source === 'file') {
    const data = value.data
    if (
      typeof data !== 'string' ||
      data.length > Math.ceil(maxFontBytes / 3) * 4 ||
      data.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/u.test(data)
    )
      throw new Error(invalidFile)
    checkFontHeader(decodeBase64(data.slice(0, 64)).buffer, bytesOf(data))
    return { source: 'file', data }
  }
  throw new Error('The profile appearance is invalid.')
}

export function fontSource(url: string) {
  return 'url(' + JSON.stringify(url) + ') format("woff2")'
}
