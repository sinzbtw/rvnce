import {
  avatarBytes,
  limits,
  parseProfile,
  type ProfileDocument,
} from '../profile/document'

export function pngDataUrl(encoded: string): string {
  return 'data:image/png;base64,' + encoded
}

export function encodeAvatar(blob: Blob): Promise<string> {
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
    throw new Error('Choose an image smaller than 4 MB.')
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const tag = new TextDecoder().decode(header)
  const png = header[0] === 137 && tag.slice(1, 4) === 'PNG'
  const jpeg = header[0] === 255 && header[1] === 216 && header[2] === 255
  const webp = tag.startsWith('RIFF') && tag.endsWith('WEBP')
  if (!(png || jpeg || webp))
    throw new Error('Choose a PNG, JPEG, or WebP image.')

  let image: ImageBitmap
  try {
    image = await createImageBitmap(file)
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
    return await encodeAvatar(blob)
  } finally {
    image.close()
  }
}

export async function importProfile(file: File): Promise<ProfileDocument> {
  if (file.size > limits.documentBytes)
    throw new Error('Choose a Rvnce JSON file smaller than 1.2 MB.')
  const doc = parseProfile(await file.text())
  if (doc.profile.avatar) {
    try {
      const image = await createImageBitmap(
        new Blob([avatarBytes(doc.profile.avatar)], { type: 'image/png' }),
      )
      image.close()
    } catch {
      throw new Error('The avatar in this profile could not be opened.')
    }
  }
  return doc
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
