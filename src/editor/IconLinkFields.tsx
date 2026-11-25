import type { IconLink } from '../profile/document'
import { iconForUrl, socialIcons, type SocialIcon } from '../profile/effects'
import { SocialIcon as IconPreview } from '../public/SocialIcon'
import { AccessoryUpload } from './AccessoryUpload'
import { useCopy } from './preferences'
import type { Message } from './messages'

const iconLabels = {
  auto: 'Automatic',
  website: 'Website',
  github: 'GitHub',
  instagram: 'Instagram',
  youtube: 'YouTube',
  telegram: 'Telegram',
  discord: 'Discord',
  twitch: 'Twitch',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  x: 'X',
  custom: 'Custom image',
} as const

export function IconLinkFields({
  link,
  update,
}: {
  link: IconLink
  update: (edit: (current: IconLink) => IconLink) => void
}) {
  const t = useCopy()
  const resolved = link.icon === 'auto' ? iconForUrl(link.url) : link.icon
  const localLabels: Partial<Record<SocialIcon, Message>> = {
    auto: 'Automatic',
    website: 'Website',
    custom: 'Custom image',
  }
  const label = (icon: SocialIcon) => {
    const message = localLabels[icon]
    return message ? t(message) : iconLabels[icon]
  }
  return (
    <>
      <label class="field">
        <span class="field-label">{t('Icon')}</span>
        <select
          aria-label={t('Icon')}
          value={link.icon}
          onChange={(event) => {
            const value = event.currentTarget.value
            const icon = socialIcons.find((choice) => choice === value)
            if (icon) update((current) => ({ ...current, icon }))
          }}
        >
          {socialIcons
            .filter((icon) => icon !== 'custom' || link.image)
            .map((icon) => (
              <option key={icon} value={icon}>
                {icon === 'auto'
                  ? label(icon) + ' · ' + label(iconForUrl(link.url))
                  : label(icon)}
              </option>
            ))}
        </select>
      </label>
      {resolved !== 'custom' && (
        <div class="link-icon-sample" aria-hidden="true">
          <IconPreview icon={resolved} />
        </div>
      )}
      <AccessoryUpload
        kind="icon"
        change={(image) =>
          update((current) => ({ ...current, icon: 'custom', image }))
        }
      />
      {link.icon === 'custom' && (
        <label class="appearance-check">
          <input
            type="checkbox"
            checked={link.tint}
            onChange={(event) => {
              const tint = event.currentTarget.checked
              update((current) => ({ ...current, tint }))
            }}
          />
          {t('Tint icon with profile colors')}
        </label>
      )}
    </>
  )
}
