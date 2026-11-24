import { checkImageSize } from './image-size'
import { hasKeys, record } from './shape'

const mib = 1024 * 1024
export const mediaLimits = {
  upload: 8 * mib,
  photo: 3 * mib,
  gif: 3 * mib,
  video: 8 * mib,
  poster: 256 * 1024,
  edge: 1920,
  motionWidth: 1920,
  motionHeight: 1080,
  gifFrames: 240,
  gifPixels: 120_000_000,
  videoSeconds: 15,
}

export type BackgroundMedia =
  | { type: 'image/jpeg' | 'image/png'; data: string }
  | { type: 'image/gif' | 'video/mp4'; data: string; poster: string }

export function bytesOf(encoded: string): number {
  return (
    (encoded.length / 4) * 3 -
    (encoded.endsWith('==') ? 2 : Number(encoded.endsWith('=')))
  )
}

export function decodeBase64(encoded: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))
}

function checkedBytes(
  encoded: unknown,
  limit: number,
): Uint8Array<ArrayBuffer> {
  if (
    typeof encoded !== 'string' ||
    encoded.length === 0 ||
    encoded.length > Math.ceil(limit / 3) * 4 ||
    encoded.length % 4 ||
    bytesOf(encoded) > limit ||
    !/^[A-Za-z0-9+/]+={0,2}$/u.test(encoded)
  ) {
    throw new Error(
      'The background file has invalid data or exceeds its size limit.',
    )
  }
  return decodeBase64(encoded)
}

const typeExtension = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
} as const

export function backgroundFilename(media: BackgroundMedia): string {
  return 'background.' + typeExtension[media.type]
}

const tag = (data: DataView, offset: number, text: string) =>
  offset + text.length <= data.byteLength &&
  Array.from(text).every(
    (character, index) =>
      character.charCodeAt(0) === data.getUint8(offset + index),
  )

export function checkGif(bytes: Uint8Array<ArrayBuffer>): void {
  if (bytes.length > mediaLimits.gif)
    throw new Error('Choose a GIF up to 3 MiB.')
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const invalid = () => {
    throw new Error('Choose a readable GIF within the frame and image limits.')
  }
  if (bytes.length < 14 || (!tag(data, 0, 'GIF87a') && !tag(data, 0, 'GIF89a')))
    return invalid()
  const width = data.getUint16(6, true)
  const height = data.getUint16(8, true)
  if (
    !width ||
    width > mediaLimits.motionWidth ||
    !height ||
    height > mediaLimits.motionHeight
  )
    return invalid()
  const tableBytes = (flags: number) =>
    flags & 128 ? 3 * 2 ** ((flags & 7) + 1) : 0
  let offset = 13 + tableBytes(data.getUint8(10))
  let frames = 0
  while (offset < bytes.length) {
    const block = data.getUint8(offset++)
    if (block === 0x3b && frames > 0 && offset === bytes.length) return
    if (block === 0x2c && offset + 9 < bytes.length) {
      const left = data.getUint16(offset, true)
      const top = data.getUint16(offset + 2, true)
      const frameWidth = data.getUint16(offset + 4, true)
      const frameHeight = data.getUint16(offset + 6, true)
      frames++
      if (
        !frameWidth ||
        !frameHeight ||
        left + frameWidth > width ||
        top + frameHeight > height ||
        frames > mediaLimits.gifFrames ||
        frames * width * height > mediaLimits.gifPixels
      )
        return invalid()
      offset += 9 + tableBytes(data.getUint8(offset + 8))
      if (
        offset >= bytes.length ||
        data.getUint8(offset) < 2 ||
        data.getUint8(offset) > 8
      )
        return invalid()
      offset++
    } else if (block === 0x21 && offset < bytes.length) offset++
    else return invalid()
    while (offset < bytes.length) {
      const length = data.getUint8(offset++)
      if (!length) break
      offset += length
    }
  }
  invalid()
}

interface Box {
  type: string
  start: number
  end: number
}

export function checkMp4(bytes: Uint8Array<ArrayBuffer>): void {
  if (bytes.length > mediaLimits.video)
    throw new Error('Choose an MP4 up to 8 MiB.')
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const invalid = (): never => {
    throw new Error('Choose a readable MP4 encoded in H.264.')
  }
  let count = 0
  function boxes(start: number, end: number): Box[] {
    const result: Box[] = []
    for (let offset = start; offset < end;) {
      if (end - offset < 8 || count++ >= 4096) invalid()
      const size = data.getUint32(offset)
      if (size < 8 || size > end - offset) invalid()
      const type = String.fromCharCode(
        ...bytes.subarray(offset + 4, offset + 8),
      )
      result.push({ type, start: offset + 8, end: offset + size })
      offset += size
    }
    return result
  }
  const top = boxes(0, bytes.length)
  const fileType = top[0]
  const movie = top.find(({ type }) => type === 'moov')
  if (
    fileType?.type !== 'ftyp' ||
    fileType.end - fileType.start < 8 ||
    !movie ||
    !top.some(({ type, start, end }) => type === 'mdat' && end > start)
  )
    return invalid()
  const brands = ['isom', 'iso2', 'mp41', 'mp42', 'avc1', 'M4V ']
  if (!brands.some((brand) => tag(data, fileType.start, brand)))
    return invalid()

  function child(parent: Box, type: string) {
    return boxes(parent.start, parent.end).find((box) => box.type === type)
  }
  const header = child(movie, 'mvhd')
  if (!header || header.end - header.start < 20) return invalid()
  const version = data.getUint8(header.start)
  if (version > 1 || (version === 1 && header.end - header.start < 32))
    return invalid()
  const timescale = data.getUint32(header.start + (version === 1 ? 20 : 12))
  const duration =
    version === 1
      ? Number(data.getBigUint64(header.start + 24))
      : data.getUint32(header.start + 16)
  const sizeError = () => {
    throw new Error('Choose a video up to 15 seconds and 1920 × 1080 pixels.')
  }
  if (
    !timescale ||
    !duration ||
    duration / timescale > mediaLimits.videoSeconds
  )
    return sizeError()
  let videoTracks = 0
  for (const track of boxes(movie.start, movie.end).filter(
    ({ type }) => type === 'trak',
  )) {
    const media = child(track, 'mdia')
    if (!media) continue
    const handler = child(media, 'hdlr')
    if (
      !handler ||
      handler.start + 12 > handler.end ||
      !tag(data, handler.start + 8, 'vide')
    )
      continue
    const info = child(media, 'minf')
    const table = info && child(info, 'stbl')
    const description = table && child(table, 'stsd')
    if (!description || description.start + 8 > description.end)
      return invalid()
    const entries = boxes(description.start + 8, description.end)
    videoTracks++
    if (
      videoTracks > 1 ||
      !entries.length ||
      entries.some(
        ({ type, start, end }) =>
          (type !== 'avc1' && type !== 'avc3') || end - start < 28,
      )
    )
      return invalid()
    for (const { start } of entries) {
      const width = data.getUint16(start + 24)
      const height = data.getUint16(start + 26)
      if (
        !width ||
        !height ||
        width > mediaLimits.motionWidth ||
        height > mediaLimits.motionHeight
      )
        return sizeError()
    }
  }
  if (!videoTracks) invalid()
}

export function validateBackgroundMedia(
  value: unknown,
): asserts value is BackgroundMedia {
  if (!record(value)) {
    throw new Error('The background file is missing.')
  }
  if (value.type === 'image/gif' || value.type === 'video/mp4') {
    if (!hasKeys(value, ['type', 'data', 'poster']))
      throw new Error('The background file is invalid.')
    const poster = checkedBytes(value.poster, mediaLimits.poster)
    checkImageSize(poster.buffer, 640, 640 ** 2, 'image/jpeg')
    if (value.type === 'image/gif')
      checkGif(checkedBytes(value.data, mediaLimits.gif))
    else checkMp4(checkedBytes(value.data, mediaLimits.video))
    return
  }
  if (
    (value.type !== 'image/png' && value.type !== 'image/jpeg') ||
    !hasKeys(value, ['type', 'data'])
  )
    throw new Error('The background format is unsupported.')
  const photo = checkedBytes(value.data, mediaLimits.photo)
  checkImageSize(
    photo.buffer,
    mediaLimits.edge,
    mediaLimits.edge ** 2,
    value.type as 'image/png' | 'image/jpeg',
  )
}
