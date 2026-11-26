import { presetAppearance, type PresetName } from './appearance'
import { defaultTabTitleMotion } from './effects'
import {
  profileVersion,
  type LinkBlock,
  type ProfileDocument,
} from './document'

export function newProfile(): ProfileDocument {
  return {
    schemaVersion: profileVersion,
    profile: { name: '', bio: '', avatar: null, language: 'en' },
    appearance: presetAppearance('minimal'),
    branding: {
      showMadeWithRvnce: true,
      favicon: null,
      tabTitle: defaultTabTitleMotion(),
    },
    blocks: [],
  }
}

interface Example {
  preset: PresetName
  title: 'Graphic' | 'Minimal' | 'Midnight' | 'Glass' | 'Neon'
  name: string
  bio: string
  links: readonly (readonly [string, string])[]
}

export const examples: readonly Example[] = [
  {
    preset: 'graphic',
    title: 'Graphic',
    name: 'sinz',
    bio: 'Projects and things I keep coming back to.',
    links: [
      ['Rvnce on GitHub', 'https://github.com/sinzbtw/rvnce'],
      ['GitHub profile', 'https://github.com/sinzbtw'],
      ['Open-source tools', 'https://github.com/explore'],
    ],
  },
  {
    preset: 'minimal',
    title: 'Minimal',
    name: 'Lina Moreno',
    bio: 'Notes on the places we live and the things we make.',
    links: [
      ['Essays', 'https://publicdomainreview.org/'],
      ['Reading list', 'https://openlibrary.org/'],
    ],
  },
  {
    preset: 'midnight',
    title: 'Midnight',
    name: 'Studio Vesper',
    bio: 'Short films, sound studies, and work made after dark.',
    links: [
      ['Moving images', 'https://archive.org/details/movies'],
      ['Listening room', 'https://freemusicarchive.org/'],
    ],
  },
  {
    preset: 'glass',
    title: 'Glass',
    name: 'Nora Vale',
    bio: 'Collecting details from the natural world.',
    links: [
      ['Field notes', 'https://www.inaturalist.org/'],
      ['Botanical archive', 'https://www.biodiversitylibrary.org/'],
    ],
  },
  {
    preset: 'neon',
    title: 'Neon',
    name: 'Patch Signal',
    bio: 'Small experiments with code, sound, and pixels.',
    links: [
      ['Creative coding', 'https://p5js.org/'],
      ['Software experiments', 'https://github.com/explore'],
    ],
  },
]

export function demoProfile(
  avatar: string | null,
  example = examples[0]!,
): ProfileDocument {
  const doc = newProfile()
  return {
    ...doc,
    profile: { ...doc.profile, name: example.name, bio: example.bio, avatar },
    appearance: presetAppearance(example.preset),
    blocks: example.links.map(([label, url], index): LinkBlock => ({
      type: 'link',
      id: 'link-' + (index + 1),
      label,
      url,
    })),
  }
}
