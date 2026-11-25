import {
  faDiscord,
  faGithub,
  faInstagram,
  faLinkedin,
  faTelegram,
  faTiktok,
  faTwitch,
  faXTwitter,
  faYoutube,
  type IconDefinition,
} from '@fortawesome/free-brands-svg-icons'
import { Globe } from 'lucide-preact'
import type { BuiltInIcon } from '../profile/effects'

const brandIcons: Record<Exclude<BuiltInIcon, 'website'>, IconDefinition> = {
  github: faGithub,
  instagram: faInstagram,
  youtube: faYoutube,
  telegram: faTelegram,
  discord: faDiscord,
  twitch: faTwitch,
  tiktok: faTiktok,
  linkedin: faLinkedin,
  x: faXTwitter,
}

export function SocialIcon({ icon }: { icon: BuiltInIcon }) {
  if (icon === 'website')
    return <Globe aria-hidden="true" size={22} strokeWidth={1.65} />

  const {
    icon: [width, height, , , paths],
    iconName,
  } = brandIcons[icon]
  return (
    <svg
      aria-hidden="true"
      class={'fa-' + iconName}
      width="22"
      height="22"
      viewBox={`0 0 ${width} ${height}`}
      fill="currentColor"
    >
      {[paths].flat().map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  )
}
