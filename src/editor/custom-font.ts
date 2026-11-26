import { useLayoutEffect, useState } from 'preact/hooks'
import {
  checkFontHeader,
  customFontFamily,
  fontSource,
  maxFontBytes,
  type CustomFont,
  type ProfileFont,
} from '../profile/fonts'
import { decodeBase64 } from '../profile/media'
import { encodeBlob } from './files'

export type FontStatus = 'loading' | 'failed' | 'ready'

export async function uploadFont(file: File): Promise<CustomFont> {
  if (file.size > maxFontBytes)
    throw new Error('Choose a valid WOFF2 font up to 1 MiB.')
  const buffer = await file.arrayBuffer()
  checkFontHeader(buffer)
  try {
    await new FontFace(customFontFamily, buffer).load()
  } catch {
    throw new Error('Choose a valid WOFF2 font up to 1 MiB.')
  }
  return { source: 'file', data: await encodeBlob(file) }
}

export function useCustomFont(font: ProfileFont): FontStatus {
  const [result, setResult] = useState<{
    font: CustomFont
    status: FontStatus
  } | null>(null)

  useLayoutEffect(() => {
    if (typeof font === 'string') return
    let active = true
    let face: FontFace | undefined
    const timer = window.setTimeout(() => fail(), 12_000)
    function fail() {
      if (!active || typeof font === 'string') return
      active = false
      window.clearTimeout(timer)
      setResult({ font, status: 'failed' })
    }
    try {
      face = new FontFace(
        customFontFamily,
        font.source === 'file'
          ? decodeBase64(font.data).buffer
          : fontSource(font.url),
        { weight: '100 900' },
      )
      void face
        .load()
        .then((loaded) => {
          if (!active) return
          window.clearTimeout(timer)
          document.fonts.add(loaded)
          setResult({ font, status: 'ready' })
        })
        .catch(fail)
    } catch {
      fail()
    }
    return () => {
      active = false
      window.clearTimeout(timer)
      if (face) document.fonts.delete(face)
    }
  }, [font])

  if (typeof font === 'string') return 'ready'
  return result?.font === font ? result.status : 'loading'
}
