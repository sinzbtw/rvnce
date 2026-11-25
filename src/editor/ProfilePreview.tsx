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
  const iconUrls = Object.fromEntries(
    doc.blocks.flatMap((block) =>
      block.type === 'icon' && block.icon === 'custom' && block.image
        ? [[block.id, pngDataUrl(block.image)]]
        : [],
    ),
  )
  return (
    <PublicProfile
      doc={doc}
      assets={{
        avatarUrl: doc.profile.avatar ? pngDataUrl(doc.profile.avatar) : null,
        cursorUrl:
          cursor.preset === 'custom' && cursor.image
            ? pngDataUrl(cursor.image)
            : undefined,
        iconUrls,
        ...media,
      }}
      preview
      previewLabels={{
        locale,
        name: t('Your name'),
        links: t('Profile links'),
        iconLinks: t('Social links'),
        credit: t('Made with Rvnce'),
        playBackground: t('Play background'),
        stopBackground: t('Stop background'),
      }}
    />
  )
}
