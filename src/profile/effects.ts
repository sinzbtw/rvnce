import { checkImageSize } from './image-size'
import { bytesOf, decodeBase64 } from './media'
import { hasKeys, isHex } from './shape'

export const cursors = [
  'default',
  'pixel',
  'neon',
  'reticle',
  'cell',
  'crosshair',
  'custom',
] as const
export type CursorPreset = (typeof cursors)[number]
export const trails = ['none', 'ghost', 'sparkles'] as const
export const overlays = [
  'none',
  'snow',
  'particles',
  'grain',
  'glitch',
  'matrix',
  'dust',
  'embers',
] as const
export const clicks = ['none', 'ripple', 'burst', 'sparkles'] as const
export const namePresets = ['glow', 'gradient'] as const
export const nameMotions = ['none', 'typewriter', 'pulse', 'stagger'] as const
export const tabTitleMotions = ['none', 'typewriter', 'scroll'] as const
export interface TabTitleMotion {
  preset: (typeof tabTitleMotions)[number]
  speed: number
}

export function defaultTabTitleMotion(): TabTitleMotion {
  return { preset: 'none', speed: 50 }
}

export function parseTabTitleMotion(value: unknown): TabTitleMotion {
  if (
    !hasKeys(value, ['preset', 'speed']) ||
    !includes(tabTitleMotions, value.preset) ||
    !validSpeed(value.speed)
  )
    throw new Error('The profile branding is invalid.')
  return { preset: value.preset, speed: value.speed }
}
export const socialIcons = [
  'auto',
  'website',
  'github',
  'instagram',
  'youtube',
  'telegram',
  'discord',
  'twitch',
  'tiktok',
  'linkedin',
  'x',
  'custom',
] as const

export type SocialIcon = (typeof socialIcons)[number]
export type BuiltInIcon = Exclude<SocialIcon, 'auto' | 'custom'>

export interface ProfileEffects {
  cursor: { preset: (typeof cursors)[number]; image: string | null }
  trail: (typeof trails)[number]
  overlay: {
    preset: (typeof overlays)[number]
    color: string
    intensity: number
  }
  click: { preset: (typeof clicks)[number]; color: string }
  sparkles: { enabled: boolean; color: string }
  name: { enabled: boolean; preset: (typeof namePresets)[number] }
  nameMotion: {
    preset: (typeof nameMotions)[number]
    speed: number
    caret: boolean
  }
}

export function overlayDefaults(
  preset: (typeof overlays)[number],
): ProfileEffects['overlay'] {
  const colors = {
    glitch: '#78e9ff',
    matrix: '#49f49a',
    dust: '#f8eedb',
    embers: '#ff9568',
  }
  return {
    preset,
    color: preset in colors ? colors[preset as keyof typeof colors] : '#ffffff',
    intensity: preset === 'glitch' ? 30 : preset === 'matrix' ? 55 : 45,
  }
}

export function defaultEffects(accent: string): ProfileEffects {
  return {
    cursor: { preset: 'default', image: null },
    trail: 'none',
    overlay: overlayDefaults('none'),
    click: { preset: 'none', color: accent },
    sparkles: { enabled: false, color: accent },
    name: { enabled: false, preset: 'glow' },
    nameMotion: { preset: 'none', speed: 50, caret: true },
  }
}

export const accessoryEdges = { cursor: 32, icon: 64 } as const
export type Accessory = keyof typeof accessoryEdges

export function accessoryBytes(encoded: unknown, kind: Accessory) {
  const invalid =
    kind === 'cursor'
      ? 'The custom cursor is not a supported PNG.'
      : 'The custom link icon is not a supported PNG.'
  const edge = accessoryEdges[kind]
  const max = 32 * 1024
  if (
    typeof encoded !== 'string' ||
    encoded.length > Math.ceil(max / 3) * 4 ||
    encoded.length % 4 !== 0 ||
    bytesOf(encoded) > max ||
    !/^[A-Za-z0-9+/]+={0,2}$/u.test(encoded)
  )
    throw new Error(invalid)
  const bytes = decodeBase64(encoded)
  try {
    const end = new DataView(bytes.buffer, bytes.length - 12)
    if (
      bytes.length < 45 ||
      end.getUint32(0) !== 0 ||
      end.getUint32(4) !== 0x49454e44
    )
      throw new Error(invalid)
    checkImageSize(bytes.buffer, edge, edge ** 2, 'image/png')
  } catch {
    throw new Error(invalid)
  }
  return bytes
}

function includes<const T>(values: readonly T[], value: unknown): value is T {
  return values.some((item) => item === value)
}

export function validSpeed(speed: unknown): speed is number {
  return (
    typeof speed === 'number' &&
    Number.isInteger(speed) &&
    speed >= 0 &&
    speed <= 100
  )
}

export function parseEffects(value: unknown, legacy = false): ProfileEffects {
  const invalid = 'The profile effects are invalid.'
  if (
    !hasKeys(value, [
      'cursor',
      'trail',
      'overlay',
      'click',
      'sparkles',
      'name',
      ...(legacy ? [] : ['nameMotion']),
    ])
  )
    throw new Error(invalid)
  const { cursor, trail, overlay, click, sparkles, name } = value
  if (
    !hasKeys(cursor, ['preset', 'image']) ||
    !includes(cursors, cursor.preset) ||
    (cursor.image === null && cursor.preset === 'custom') ||
    !includes(trails, trail) ||
    !hasKeys(overlay, ['preset', 'color', 'intensity']) ||
    !includes(overlays, overlay.preset) ||
    !isHex(overlay.color) ||
    typeof overlay.intensity !== 'number' ||
    !Number.isInteger(overlay.intensity) ||
    overlay.intensity < 0 ||
    overlay.intensity > 100 ||
    !hasKeys(click, ['preset', 'color']) ||
    !includes(clicks, click.preset) ||
    !isHex(click.color) ||
    !hasKeys(sparkles, ['enabled', 'color']) ||
    typeof sparkles.enabled !== 'boolean' ||
    !isHex(sparkles.color) ||
    !hasKeys(name, ['enabled', 'preset']) ||
    typeof name.enabled !== 'boolean' ||
    !includes(namePresets, name.preset)
  )
    throw new Error(invalid)
  if (cursor.image !== null) accessoryBytes(cursor.image, 'cursor')
  const nameMotion = legacy
    ? defaultEffects('#ffffff').nameMotion
    : value.nameMotion
  if (
    !hasKeys(nameMotion, ['preset', 'speed', 'caret']) ||
    !includes(nameMotions, nameMotion.preset) ||
    !validSpeed(nameMotion.speed) ||
    typeof nameMotion.caret !== 'boolean'
  )
    throw new Error(invalid)
  return { ...value, nameMotion } as unknown as ProfileEffects
}

const sites: Record<Exclude<BuiltInIcon, 'website'>, readonly string[]> = {
  github: ['github.com'],
  instagram: ['instagram.com'],
  youtube: ['youtube.com', 'youtu.be'],
  telegram: ['telegram.me', 't.me', 'telegram.org'],
  discord: ['discord.com', 'discord.gg'],
  twitch: ['twitch.tv'],
  tiktok: ['tiktok.com'],
  linkedin: ['linkedin.com'],
  x: ['x.com', 'twitter.com'],
}

export function iconForUrl(url: string): BuiltInIcon {
  try {
    const { hostname } = new URL(url)
    for (const [icon, hosts] of Object.entries(sites)) {
      if (
        hosts.some((host) => hostname === host || hostname.endsWith('.' + host))
      )
        return icon as BuiltInIcon
    }
  } catch {
    // Incomplete URLs are allowed in draft links.
  }
  return 'website'
}
