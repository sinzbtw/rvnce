import { checkImageSize } from './image-size'
import { bytesOf, decodeBase64 } from './media'
import { hasKeys, isHex } from './shape'

export const cursors = ['default', 'cell', 'crosshair', 'custom'] as const
export const trails = ['none', 'ghost', 'sparkles'] as const
export const overlays = ['none', 'snow', 'particles', 'grain'] as const
export const clicks = ['none', 'ripple', 'burst', 'sparkles'] as const
export const namePresets = ['glow', 'gradient'] as const
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
}

export function defaultEffects(accent: string): ProfileEffects {
  return {
    cursor: { preset: 'default', image: null },
    trail: 'none',
    overlay: { preset: 'none', color: '#ffffff', intensity: 45 },
    click: { preset: 'none', color: accent },
    sparkles: { enabled: false, color: accent },
    name: { enabled: false, preset: 'glow' },
  }
}

export const accessoryEdges = { cursor: 32 } as const
export type Accessory = keyof typeof accessoryEdges

export function accessoryBytes(encoded: unknown, kind: Accessory) {
  const invalid = 'The custom cursor is not a supported PNG.'
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

export function parseEffects(value: unknown): ProfileEffects {
  const invalid = 'The profile effects are invalid.'
  if (
    !hasKeys(value, ['cursor', 'trail', 'overlay', 'click', 'sparkles', 'name'])
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
  return value as unknown as ProfileEffects
}
