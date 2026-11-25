import {
  avatarBytes,
  faviconBytes,
  limits,
  parseProfile,
  parseTheme,
  type ProfileDocument,
} from '../profile/document'
import { checkImageSize } from '../profile/image-size'
import {
  accessoryBytes,
  accessoryEdges,
  type Accessory,
} from '../profile/effects'

export function pngDataUrl(encoded: string): string {
  return 'data:image/png;base64,' + encoded
}

export function encodeBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('The image could not be read.'))
    reader.onload = () => {
      const encoded = String(reader.result).split(',')[1]
      if (encoded) resolve(encoded)
      else reject(new Error('The image could not be read.'))
    }
    reader.readAsDataURL(blob)
  })
}

export async function normalizeAvatar(file: File): Promise<string> {
  return normalizeImage(file, false)
}

export async function normalizeFavicon(file: File): Promise<string> {
  return normalizeImage(file, true)
}

export async function normalizeAccessory(
  file: File,
  kind: Accessory,
): Promise<string> {
  if (file.size > limits.uploadBytes)
    throw new Error('Choose an image up to 4 MiB.')
  checkImageSize(await file.arrayBuffer())
  return encodeBlob(
    await canvasPng(file, false, accessoryEdges[kind], 32 * 1024),
  )
}

async function normalizeImage(file: File, favicon: boolean): Promise<string> {
  if (file.size > limits.uploadBytes)
    throw new Error('Choose an image up to 4 MiB.')
  checkImageSize(await file.arrayBuffer())
  return encodeBlob(await canvasPng(file, favicon))
}

async function canvasPng(
  source: Blob,
  favicon = false,
  edge = favicon ? limits.faviconEdge : limits.avatarEdge,
  byteLimit = favicon ? limits.faviconBytes : limits.avatarBytes,
): Promise<Blob> {
  let image: ImageBitmap
  try {
    image = await createImageBitmap(source)
  } catch {
    throw new Error('This image could not be opened.')
  }
  try {
    const fit = edge / Math.max(image.width, image.height)
    const scale = favicon ? fit : Math.min(1, fit)
    const width = Math.max(1, Math.round(image.width * scale))
    const height = Math.max(1, Math.round(image.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = favicon ? edge : width
    canvas.height = favicon ? edge : height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('The browser could not resize the image.')
    ctx.drawImage(
      image,
      Math.floor((canvas.width - width) / 2),
      Math.floor((canvas.height - height) / 2),
      width,
      height,
    )
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    )
    if (!blob || blob.size > byteLimit)
      throw new Error(
        favicon
          ? 'The resized favicon is too large.'
          : 'The resized avatar is too large.',
      )
    return blob
  } finally {
    image.close()
  }
}

function pngBlob(encoded: string, favicon = false) {
  return new Blob([favicon ? faviconBytes(encoded) : avatarBytes(encoded)], {
    type: 'image/png',
  })
}

export async function publishedAvatar(
  encoded: string,
): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await (await canvasPng(pngBlob(encoded))).arrayBuffer())
}

export async function publishedFavicon(
  encoded: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const blob = await canvasPng(pngBlob(encoded, true), true)
  return new Uint8Array(await blob.arrayBuffer())
}

export async function importProfile(file: File): Promise<ProfileDocument> {
  const doc = parseProfile(await readJsonFile(file), 'draft')
  await Promise.all([
    checkImportedPng(doc.profile.avatar, false),
    checkImportedPng(doc.branding.favicon, true),
    checkImportedAccessory(doc.appearance.effects.cursor.image, 'cursor'),
    checkImportedBackground(doc.appearance.background.media),
  ])
  return doc
}

async function checkImportedPng(encoded: string | null, favicon: boolean) {
  if (!encoded) return
  try {
    const image = await createImageBitmap(pngBlob(encoded, favicon))
    image.close()
  } catch {
    throw new Error(
      favicon
        ? 'The favicon in this profile could not be opened.'
        : 'The avatar in this profile could not be opened.',
    )
  }
}

async function checkImportedAccessory(encoded: string | null, kind: Accessory) {
  if (!encoded) return
  try {
    const image = await createImageBitmap(
      new Blob([accessoryBytes(encoded, kind)], { type: 'image/png' }),
    )
    image.close()
  } catch {
    throw new Error('The custom cursor is not a supported PNG.')
  }
}

export async function importTheme(file: File) {
  const theme = parseTheme(await readJsonFile(file))
  await Promise.all([
    checkImportedBackground(theme.appearance.background.media),
    checkImportedAccessory(theme.appearance.effects.cursor.image, 'cursor'),
  ])
  return theme
}

async function readJsonFile(file: File) {
  if (file.size > limits.documentBytes)
    throw new Error('Choose a Rvnce JSON file smaller than 16 MiB.')
  return file.text()
}

async function checkImportedBackground(
  media: ProfileDocument['appearance']['background']['media'],
) {
  if (!media) return
  const { decodeImportedBackground } = await import('./background-files')
  await decodeImportedBackground(media)
}

export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
