type ImageSize = [width: number, height: number]

function jpegSize(data: DataView): ImageSize | undefined {
  let offset = 2
  while (offset + 4 <= data.byteLength && data.getUint8(offset++) === 0xff) {
    while (offset < data.byteLength && data.getUint8(offset) === 0xff) offset++
    if (offset + 3 > data.byteLength) return
    const marker = data.getUint8(offset++)
    if (marker === 0xd9 || marker === 0xda) return
    const length = data.getUint16(offset)
    if (length < 2 || offset + length > data.byteLength) return
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc &&
      length >= 8
    ) {
      return [data.getUint16(offset + 5), data.getUint16(offset + 3)]
    }
    offset += length
  }
}

function webpSize(data: DataView): ImageSize | undefined {
  const chunk = data.getUint32(12)
  const length = data.getUint32(16, true)
  if (length > data.byteLength - 20) return
  // Extended WebP stores the canvas size, including for animated files.
  if (chunk === 0x56503858 && length >= 10) {
    const read24 = (offset: number) =>
      data.getUint16(offset, true) + data.getUint8(offset + 2) * 65536
    return [read24(24) + 1, read24(27) + 1]
  }
  if (chunk === 0x5650384c && length >= 5 && data.getUint8(20) === 0x2f) {
    const size = data.getUint32(21, true)
    return [(size & 0x3fff) + 1, ((size >>> 14) & 0x3fff) + 1]
  }
  if (
    chunk === 0x56503820 &&
    length >= 10 &&
    data.getUint16(23) === 0x9d01 &&
    data.getUint8(25) === 0x2a
  ) {
    return [
      data.getUint16(26, true) & 0x3fff,
      data.getUint16(28, true) & 0x3fff,
    ]
  }
}

export function checkImageSize(
  buffer: ArrayBuffer,
  maxEdge = 8192,
  maxPixels = 24_000_000,
  expectedType?: 'image/png' | 'image/jpeg',
): void {
  const data = new DataView(buffer)
  let size: ImageSize | undefined
  let type = ''
  if (
    data.byteLength >= 24 &&
    data.getUint32(0) === 0x89504e47 &&
    data.getUint32(4) === 0x0d0a1a0a &&
    data.getUint32(8) === 13 &&
    data.getUint32(12) === 0x49484452
  ) {
    type = 'image/png'
    size = [data.getUint32(16), data.getUint32(20)]
  } else if (data.byteLength >= 3 && data.getUint16(0) === 0xffd8) {
    type = 'image/jpeg'
    size = jpegSize(data)
  } else if (
    data.byteLength >= 20 &&
    data.getUint32(0) === 0x52494646 &&
    data.getUint32(8) === 0x57454250
  ) {
    type = 'image/webp'
    size = webpSize(data)
  }
  if (
    !size ||
    !size[0] ||
    !size[1] ||
    (expectedType && type !== expectedType)
  ) {
    throw new Error('Choose a readable PNG, JPEG, or WebP image.')
  }
  if (Math.max(...size) > maxEdge || size[0] * size[1] > maxPixels) {
    throw new Error(
      'Choose an image up to ' +
        maxPixels / 1_000_000 +
        ' megapixels and ' +
        maxEdge +
        ' pixels per side.',
    )
  }
}
