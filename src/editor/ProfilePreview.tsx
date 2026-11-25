import type { ProfileDocument } from '../profile/document'
import { PublicProfile } from '../public/PublicProfile'
import { pngDataUrl } from './files'
import { type Locale } from './messages'
import { useCopy } from './preferences'
import { usePreviewMedia } from './usePreviewMedia'

export function ProfilePreview({
  doc,
  locale,
  shown = true,
}: {
  doc: ProfileDocument
  locale: Locale
  shown?: boolean
}) {
  const t = useCopy()
  const media = usePreviewMedia(shown ? doc.appearance.background.media : null)
  const cursor = doc.appearance.effects.cursor
  return (
    <PublicProfile
      doc={doc}
      assets={{
        avatarUrl: doc.profile.avatar ? pngDataUrl(doc.profile.avatar) : null,
        cursorUrl:
          cursor.preset === 'custom' && cursor.image
            ? pngDataUrl(cursor.image)
            : undefined,
        ...media,
      }}
      preview
      previewLabels={{
        locale,
        name: t('Your name'),
        links: t('Profile links'),
        credit: t('Made with Rvnce'),
        playBackground: t('Play background'),
        stopBackground: t('Stop background'),
      }}
    />
  )
}
