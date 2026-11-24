import { useEffect, useState } from 'preact/hooks'
import { decodeBase64, type BackgroundMedia } from '../profile/media'

export function usePreviewMedia(media: BackgroundMedia | null) {
  const [asset, setAsset] = useState<{
    media: BackgroundMedia
    backgroundUrl: string
    posterUrl?: string
  } | null>(null)
  useEffect(() => {
    if (!media) {
      setAsset(null)
      return
    }
    const backgroundUrl = URL.createObjectURL(
      new Blob([decodeBase64(media.data)], { type: media.type }),
    )
    const posterUrl =
      'poster' in media
        ? URL.createObjectURL(
            new Blob([decodeBase64(media.poster)], { type: 'image/jpeg' }),
          )
        : undefined
    setAsset({ media, backgroundUrl, ...(posterUrl ? { posterUrl } : {}) })
    return () => {
      URL.revokeObjectURL(backgroundUrl)
      if (posterUrl) URL.revokeObjectURL(posterUrl)
    }
  }, [media])
  return asset?.media === media ? asset : null
}
