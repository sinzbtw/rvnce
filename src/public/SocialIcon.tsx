import type { BuiltInIcon } from '../profile/effects'

const symbols: Record<BuiltInIcon, string> = {
  website:
    'M3 12h18M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm0 0c5 5 5 13 0 18-5-5-5-13 0-18Z',
  github:
    'M8 21v-3l-2-1-2-3c-1-2 0-4 1-5V5l4 2h6l4-2v4c1 1 2 3 1 5s-2 3-4 4v3M4 17l2 2h2M9 12v1m6-1v1',
  instagram:
    'M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5Zm8 9a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm1-5h.01',
  youtube:
    'M7 5h10a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4Zm3 4 5 3-5 3V9Z',
  telegram: 'm3 11 18-7-4 16-6-5-3 3v-5l9-6M3 11l5 2',
  discord:
    'm8 6-4 2-2 9 5 2 2-3m7-10 4 2 2 9-5 2-2-3M7 16c3 1 7 1 10 0M8 6c2 1 6 1 8 0M8.5 12h.01m6.99 0h.01',
  twitch: 'M4 3h17v11l-5 5h-4l-4 3v-3H4V3Zm6 4v5m6-5v5',
  tiktok: 'M14 3v12a4 4 0 1 1-4-4m4-8c1 4 3 5 6 5',
  linkedin: 'M5 9v10M5 5h.01M10 19V9m0 4a4 4 0 1 1 8 0v6',
  x: 'M4 4h4l12 16h-4L4 4Zm16 0-7 8m-2 2-7 6',
}

export function SocialIcon({ icon }: { icon: BuiltInIcon }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.65"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={symbols[icon]} />
    </svg>
  )
}
