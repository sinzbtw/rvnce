import { checkImageSize } from '../profile/image-size'
import {
  checkGif,
  checkMp4,
  decodeBase64,
  mediaLimits,
  type BackgroundMedia,
} from '../profile/media'
import { encodeBlob } from './files'

function boundedCanvas(width: number, height: number, edge: number) {
  const scale = Math.min(1, edge / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('The browser could not prepare the background.')
  return { canvas, ctx }
}

function writeCanvas(
  canvas: HTMLCanvasElement,
  type: 'image/png' | 'image/jpeg',
) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => {
        if (blob && blob.type === type) resolve(blob)
        else reject(new Error('The browser could not encode the background.'))
      },
      type,
      0.84,
    ),
  )
}

async function imageBitmap(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob)
  } catch {
    throw new Error('The background image could not be opened.')
  }
}

function draw(
  source: CanvasImageSource,
  width: number,
  height: number,
  edge: number,
) {
  const { canvas, ctx } = boundedCanvas(width, height, edge)
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

async function makePoster(
  source: CanvasImageSource,
  width: number,
  height: number,
) {
  const blob = await writeCanvas(draw(source, width, height, 640), 'image/jpeg')
  if (blob.size > mediaLimits.poster)
    throw new Error('The background poster is too large.')
  return encodeBlob(blob)
}

class LocalVideoError extends Error {}

async function withVideo<T>(
  blob: Blob,
  ready: (video: HTMLVideoElement) => Promise<T>,
): Promise<T> {
  const video = document.createElement('video')
  if (!video.canPlayType('video/mp4; codecs="avc1.42E01E"')) {
    throw new LocalVideoError('This browser cannot play local H.264 video.')
  }
  const url = URL.createObjectURL(blob)
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  let timer: number | undefined
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => {
        if (
          !video.videoWidth ||
          !video.videoHeight ||
          video.videoWidth > mediaLimits.motionWidth ||
          video.videoHeight > mediaLimits.motionHeight ||
          !Number.isFinite(video.duration) ||
          video.duration <= 0 ||
          video.duration > mediaLimits.videoSeconds
        ) {
          reject(
            new Error(
              'Choose a video up to 15 seconds and 1920 × 1080 pixels.',
            ),
          )
        }
      }
      video.onloadeddata = () => resolve()
      video.onerror = () => {
        if (video.error?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
          reject(
            new LocalVideoError('This browser cannot play local H.264 video.'),
          )
        } else {
          reject(new Error('The MP4 background could not be opened.'))
        }
      }
      timer = window.setTimeout(
        () => reject(new Error('The video could not be decoded in time.')),
        8000,
      )
      video.src = url
    })
    return await ready(video)
  } finally {
    window.clearTimeout(timer)
    video.onloadeddata = null
    video.onloadedmetadata = null
    video.onerror = null
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }
}

export async function loadBackground(
  file: File,
): Promise<BackgroundMedia | { needsPoster: string }> {
  if (file.size > mediaLimits.upload)
    throw new Error('Choose a background file up to 8 MiB.')
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const gif = bytes[0] === 71 && bytes[1] === 73 && bytes[2] === 70
  const mp4 =
    bytes[4] === 102 && bytes[5] === 116 && bytes[6] === 121 && bytes[7] === 112
  if (mp4) {
    checkMp4(bytes)
    const blob = new Blob([buffer], { type: 'video/mp4' })
    try {
      const poster = await withVideo(blob, (video) =>
        makePoster(video, video.videoWidth, video.videoHeight),
      )
      return { type: 'video/mp4', data: await encodeBlob(blob), poster }
    } catch (error) {
      if (!(error instanceof LocalVideoError)) throw error
      return { needsPoster: await encodeBlob(blob) }
    }
  }
  if (gif) {
    checkGif(bytes)
    const blob = new Blob([buffer], { type: 'image/gif' })
    const image = await imageBitmap(blob)
    try {
      return {
        type: 'image/gif',
        data: await encodeBlob(blob),
        poster: await makePoster(image, image.width, image.height),
      }
    } finally {
      image.close()
    }
  }
  checkImageSize(buffer)
  const type = bytes[0] === 0xff ? 'image/jpeg' : 'image/png'
  const image = await imageBitmap(file)
  try {
    for (const edge of [mediaLimits.edge, 1440, 960]) {
      const blob = await writeCanvas(
        draw(image, image.width, image.height, edge),
        type,
      )
      if (blob.size <= mediaLimits.photo)
        return { type, data: await encodeBlob(blob) }
    }
    throw new Error(
      'The resized background is too large. Choose a smaller image.',
    )
  } finally {
    image.close()
  }
}

export async function loadVideoPoster(file: File): Promise<string> {
  if (file.size > mediaLimits.upload)
    throw new Error('Choose a poster image up to 8 MiB.')
  checkImageSize(await file.arrayBuffer())
  const image = await imageBitmap(file)
  try {
    return await makePoster(image, image.width, image.height)
  } finally {
    image.close()
  }
}

export async function decodeImportedBackground(media: BackgroundMedia | null) {
  if (!media) return
  await verifyImage(
    new Blob([decodeBase64('poster' in media ? media.poster : media.data)], {
      type: 'poster' in media ? 'image/jpeg' : media.type,
    }),
  )
  if (media.type === 'image/gif') {
    await verifyImage(
      new Blob([decodeBase64(media.data)], { type: media.type }),
    )
  } else if (media.type === 'video/mp4') {
    try {
      await withVideo(
        new Blob([decodeBase64(media.data)], { type: media.type }),
        () => Promise.resolve(),
      )
    } catch (error) {
      // Some browser builds can play the exported URL but can't open a Blob.
      if (!(error instanceof LocalVideoError)) throw error
    }
  }
}

async function verifyImage(blob: Blob) {
  const image = await imageBitmap(blob)
  image.close()
}
