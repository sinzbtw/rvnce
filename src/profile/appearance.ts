import { validateBackgroundMedia, type BackgroundMedia } from './media'
import { defaultEffects, parseEffects, type ProfileEffects } from './effects'
import { parseFont, type ProfileFont } from './fonts'
import { hasKeys, isHex } from './shape'

export const presetNames = [
  'minimal',
  'midnight',
  'glass',
  'neon',
  'graphic',
] as const
export const variants = ['light', 'dark'] as const
export const positions = ['start', 'center', 'end'] as const
export const backgroundKinds = ['color', 'linear', 'radial', 'media'] as const
export const fits = ['cover', 'contain'] as const
export const avatarShapes = ['circle', 'rounded', 'square', 'graphic'] as const
export const linkStyles = ['solid', 'outline', 'soft', 'graphic'] as const
export const hoverStyles = ['none', 'lift', 'slide'] as const
export const shadows = ['none', 'soft', 'deep'] as const
export type PresetName = (typeof presetNames)[number]
export type Variant = (typeof variants)[number]

export interface Appearance {
  preset: PresetName
  variant: Variant
  accent: string
  background: {
    kind: (typeof backgroundKinds)[number]
    color: string
    endColor: string
    angle: number
    x: number
    y: number
    fit: (typeof fits)[number]
    scale: number
    dim: number
    blur: number
    media: BackgroundMedia | null
  }
  typography: {
    font: ProfileFont
    nameSize: number
    bioSize: number
    nameWeight: number
    bioWeight: number
    color: string
    bioColor: string
    align: (typeof positions)[number]
  }
  card: {
    width: number
    padding: number
    color: string
    opacity: number
    radius: number
    blur: number
    border: number
    borderColor: string
    shadow: (typeof shadows)[number]
  }
  avatar: {
    position: 'above' | 'start' | 'end'
    size: number
    shape: (typeof avatarShapes)[number]
  }
  links: {
    style: (typeof linkStyles)[number]
    color: string
    text: string
    radius: number
    border: number
    borderColor: string
    shadow: (typeof shadows)[number]
    height: number
    gap: number
    hover: (typeof hoverStyles)[number]
  }
  entrance: boolean
  effects: ProfileEffects
}

export const defaultAccent = '#4434d4'

const palettes: Record<
  PresetName,
  Record<
    Variant,
    readonly [
      page: string,
      end: string,
      card: string,
      name: string,
      bio: string,
      accent: string,
      link: string,
      linkText: string,
      border: string,
    ]
  >
> = {
  minimal: {
    light: [
      '#f7f6f2',
      '#ede9e1',
      '#ffffff',
      '#211f1a',
      '#504c42',
      '#284842',
      '#e7eeea',
      '#203833',
      '#536a62',
    ],
    dark: [
      '#161b19',
      '#28332e',
      '#252d28',
      '#f7f6f2',
      '#c5d1c8',
      '#a7ceb6',
      '#334139',
      '#f7f6f2',
      '#8da897',
    ],
  },
  midnight: {
    light: [
      '#e9eaf2',
      '#e7d1bb',
      '#fff8ec',
      '#222640',
      '#4e4857',
      '#8f4b30',
      '#2e3859',
      '#fff8ec',
      '#926d56',
    ],
    dark: [
      '#10172a',
      '#312747',
      '#192238',
      '#fff3e0',
      '#d6c9ba',
      '#edb587',
      '#2c3956',
      '#fff3e0',
      '#bb947a',
    ],
  },
  glass: {
    light: [
      '#d6e7f6',
      '#eddbed',
      '#ffffff',
      '#241a35',
      '#473952',
      '#4e367c',
      '#493677',
      '#ffffff',
      '#72618a',
    ],
    dark: [
      '#151334',
      '#573444',
      '#241934',
      '#fbecff',
      '#e2d1eb',
      '#e9aade',
      '#4b3d6c',
      '#fff0fb',
      '#b6a0cf',
    ],
  },
  neon: {
    light: [
      '#f1f5de',
      '#d0f8b2',
      '#ffffff',
      '#1f2c17',
      '#3c502d',
      '#255b2d',
      '#e4facb',
      '#19341d',
      '#396139',
    ],
    dark: [
      '#131b19',
      '#233a2a',
      '#1d2923',
      '#e7ffcf',
      '#c2d5c6',
      '#c3fd5f',
      '#1e3228',
      '#d9ffaf',
      '#a3d65a',
    ],
  },
  graphic: {
    light: [
      '#eae5fc',
      '#f9f7ff',
      '#eae5fc',
      '#19152a',
      '#4b4365',
      defaultAccent,
      defaultAccent,
      '#ffffff',
      '#8f83b3',
    ],
    dark: [
      '#221c35',
      '#302644',
      '#221c35',
      '#f5efff',
      '#d6c9ef',
      defaultAccent,
      defaultAccent,
      '#ffffff',
      '#9786be',
    ],
  },
}

export const presetVariant: Record<PresetName, Variant> = {
  minimal: 'light',
  midnight: 'dark',
  glass: 'light',
  neon: 'dark',
  graphic: 'light',
}

export function presetAppearance(
  preset: PresetName,
  variant = presetVariant[preset],
): Appearance {
  const [page, end, card, name, bio, accent, link, text, border] =
    palettes[preset][variant]
  const graphic = preset === 'graphic'
  const minimal = preset === 'minimal'
  const glass = preset === 'glass'
  const neon = preset === 'neon'
  return {
    preset,
    variant,
    accent,
    background: {
      kind: glass ? 'radial' : minimal || graphic ? 'color' : 'linear',
      color: page,
      endColor: end,
      angle: 145,
      x: 50,
      y: 50,
      fit: 'cover',
      scale: 100,
      dim: 0,
      blur: 0,
      media: null,
    },
    typography: {
      font: minimal ? 'source-serif-4' : neon ? 'source-sans-3' : 'manrope',
      nameSize: graphic ? 76 : neon ? 58 : 48,
      bioSize: 16,
      nameWeight: graphic || neon ? 800 : 650,
      bioWeight: 400,
      color: name,
      bioColor: bio,
      align: glass || minimal ? 'center' : 'start',
    },
    card: {
      width: graphic ? 640 : minimal ? 480 : 560,
      padding: graphic ? 46 : minimal ? 28 : 38,
      color: card,
      opacity: glass ? 74 : minimal ? 0 : 100,
      radius: graphic || minimal ? 0 : neon ? 16 : 24,
      blur: glass ? 16 : 0,
      border: neon || glass ? 1 : 0,
      borderColor: border,
      shadow: glass ? 'deep' : graphic || minimal ? 'none' : 'soft',
    },
    avatar: {
      position: graphic ? 'end' : 'above',
      size: graphic ? 160 : preset === 'midnight' ? 104 : 88,
      shape: graphic ? 'graphic' : glass || minimal ? 'circle' : 'rounded',
    },
    links: {
      style: graphic
        ? 'graphic'
        : neon
          ? 'outline'
          : minimal
            ? 'soft'
            : 'solid',
      color: link,
      text,
      radius: graphic ? 0 : neon ? 7 : 12,
      border: neon ? 1 : 0,
      borderColor: border,
      shadow: 'none',
      height: minimal ? 48 : 50,
      gap: graphic ? 9 : minimal ? 8 : 12,
      hover: graphic ? 'slide' : 'lift',
    },
    entrance: !graphic,
    effects: defaultEffects(accent),
  }
}

type Predicate = (value: unknown) => boolean

export function member<const T>(values: readonly T[]) {
  return (value: unknown): value is T => values.some((item) => item === value)
}

export function integer(min: number, max: number): Predicate {
  return (value) =>
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
}

export const ranges = {
  angle: [0, 360],
  percent: [0, 100],
  scale: [100, 160],
  blur: [0, 24],
  nameSize: [24, 96],
  bioSize: [14, 28],
  weight: [200, 800],
  width: [320, 800],
  padding: [12, 64],
  radius: [0, 48],
  border: [0, 4],
  avatarSize: [36, 192],
  linkHeight: [44, 80],
  gap: [4, 28],
} as const

function group(value: unknown, fields: Record<string, Predicate>): boolean {
  return (
    hasKeys(value, Object.keys(fields)) &&
    Object.entries(fields).every(([key, validate]) => validate(value[key]))
  )
}

const alpha = integer(...ranges.percent)
const blur = integer(...ranges.blur)
const radius = integer(...ranges.radius)
const border = integer(...ranges.border)
const weight = integer(...ranges.weight)

export function parseAppearance(
  value: unknown,
  format: 'classic' | 'effects' | 'current' = 'current',
): Appearance {
  const legacy = format === 'classic'
  if (
    !hasKeys(value, [
      'preset',
      'variant',
      'accent',
      'background',
      'typography',
      'card',
      'avatar',
      'links',
      'entrance',
      ...(legacy ? [] : ['effects']),
    ]) ||
    !member(presetNames)(value.preset) ||
    !member(variants)(value.variant) ||
    !isHex(value.accent) ||
    typeof value.entrance !== 'boolean' ||
    !group(value.background, {
      kind: member(backgroundKinds),
      color: isHex,
      endColor: isHex,
      angle: integer(...ranges.angle),
      x: alpha,
      y: alpha,
      fit: member(fits),
      scale: integer(...ranges.scale),
      dim: alpha,
      blur,
      media: () => true,
    }) ||
    !group(value.typography, {
      font: () => true,
      nameSize: integer(...ranges.nameSize),
      bioSize: integer(...ranges.bioSize),
      nameWeight: weight,
      bioWeight: weight,
      color: isHex,
      bioColor: isHex,
      align: member(positions),
    }) ||
    !group(value.card, {
      width: integer(...ranges.width),
      padding: integer(...ranges.padding),
      color: isHex,
      opacity: alpha,
      radius,
      blur,
      border,
      borderColor: isHex,
      shadow: member(shadows),
    }) ||
    !group(value.avatar, {
      position: member(['above', 'start', 'end']),
      size: integer(...ranges.avatarSize),
      shape: member(avatarShapes),
    }) ||
    !group(value.links, {
      style: member(linkStyles),
      color: isHex,
      text: isHex,
      radius,
      border,
      borderColor: isHex,
      shadow: member(shadows),
      height: integer(...ranges.linkHeight),
      gap: integer(...ranges.gap),
      hover: member(hoverStyles),
    })
  )
    throw new Error('The profile appearance is invalid.')
  const appearance = value as unknown as Appearance
  if (appearance.background.kind === 'media')
    validateBackgroundMedia(appearance.background.media)
  else if (appearance.background.media !== null)
    throw new Error('Choose a media background before adding a file.')
  return {
    ...appearance,
    typography: {
      ...appearance.typography,
      font: parseFont(appearance.typography.font),
    },
    effects: legacy
      ? defaultEffects(appearance.accent)
      : parseEffects(value.effects, format === 'effects'),
  }
}
