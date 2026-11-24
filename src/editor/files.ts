import {
  avatarBytes,
  limits,
  parseProfile,
  parseTheme,
  type ProfileDocument,
} from '../profile/document'
import { checkImageSize } from '../profile/image-size'

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
  if (file.size > limits.uploadBytes)
    throw new Error('Choose an image up to 4 MiB.')
  checkImageSize(await file.arrayBuffer())
  return encodeBlob(await canvasPng(file))
}

async function canvasPng(source: Blob): Promise<Blob> {
  let image: ImageBitmap
  try {
    image = await createImageBitmap(source)
  } catch {
    throw new Error('This image could not be opened.')
  }
  try {
    const scale = Math.min(
      1,
      limits.avatarEdge / Math.max(image.width, image.height),
    )
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('The browser could not resize the image.')
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    )
    if (!blob || blob.size > limits.avatarBytes)
      throw new Error('The resized avatar is too large.')
    return blob
  } finally {
    image.close()
  }
}

function pngBlob(encoded: string) {
  return new Blob([avatarBytes(encoded)], { type: 'image/png' })
}

export async function publishedAvatar(
  encoded: string,
): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await (await canvasPng(pngBlob(encoded))).arrayBuffer())
}

export async function importProfile(file: File): Promise<ProfileDocument> {
  const doc = parseProfile(await readJsonFile(file), 'draft')
  if (doc.profile.avatar) {
    try {
      const image = await createImageBitmap(pngBlob(doc.profile.avatar))
      image.close()
    } catch {
      throw new Error('The avatar in this profile could not be opened.')
    }
  }
  await checkImportedBackground(doc.appearance.background.media)
  return doc
}

export async function importTheme(file: File) {
  const theme = parseTheme(await readJsonFile(file))
  await checkImportedBackground(theme.appearance.background.media)
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
