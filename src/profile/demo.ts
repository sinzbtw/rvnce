import { defaultAccent, type ProfileDocument } from './document'

export function demoProfile(avatar: string | null): ProfileDocument {
  return {
    schemaVersion: 2,
    profile: {
      name: 'Mira Park',
      bio: 'Independent designer making posters, type, and other things destined for a wall.',
      avatar,
      language: 'en',
    },
    appearance: { theme: 'rvnce', variant: 'light', accent: defaultAccent },
    blocks: [
      {
        id: 'archive',
        type: 'link',
        label: 'Visual archive',
        url: 'https://www.are.na/',
      },
      {
        id: 'references',
        type: 'link',
        label: 'Design references',
        url: 'https://www.behance.net/galleries/graphic-design',
      },
      {
        id: 'tools',
        type: 'link',
        label: 'Open-source tools',
        url: 'https://github.com/explore',
      },
    ],
  }
}
