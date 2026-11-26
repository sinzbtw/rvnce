import { accentInk } from '../profile/colors'
import type { Appearance, FontName } from '../profile/appearance'

export const fontFamilies: Record<FontName, string> = {
  manrope: 'Manrope Variable',
  'source-sans-3': 'Source Sans 3 Variable',
  'source-serif-4': 'Source Serif 4 Variable',
}

const shadow = {
  none: 'none',
  soft: '0 8px 24px #10152326',
  deep: '0 18px 52px #1015233d',
} as const

function alphaHex(percent: number) {
  return Math.round((255 * percent) / 100)
    .toString(16)
    .padStart(2, '0')
}

export function profileVariables(
  appearance: Appearance,
): Record<string, string> {
  const { accent, avatar, background, card, links, typography } = appearance
  const position = background.x + '% ' + background.y + '%'
  const surface =
    background.kind === 'linear'
      ? 'linear-gradient(' +
        background.angle +
        'deg,' +
        background.color +
        ',' +
        background.endColor +
        ')'
      : background.kind === 'radial'
        ? 'radial-gradient(ellipse at ' +
          position +
          ',' +
          background.endColor +
          ',' +
          background.color +
          ')'
        : background.color
  return {
    '--accent': accent,
    '--accent-ink': accentInk(accent),
    '--page-bg': background.color,
    '--page-surface': surface,
    '--media-position': position,
    '--media-fit': background.fit,
    '--media-scale': String(background.scale / 100),
    '--media-blur': background.blur + 'px',
    '--media-inset': -background.blur * 2 + 'px',
    '--media-dim': String(background.dim / 100),
    '--profile-font':
      '"' +
      fontFamilies[typography.font] +
      '",' +
      (typography.font === 'source-serif-4'
        ? 'Georgia,serif'
        : 'system-ui,sans-serif'),
    '--name-size': typography.nameSize / 16 + 'rem',
    '--graphic-name-fluid': (14 * typography.nameSize) / 76 + 'cqi',
    '--name-weight': String(typography.nameWeight),
    '--bio-size': typography.bioSize / 16 + 'rem',
    '--bio-weight': String(typography.bioWeight),
    '--name-color': typography.color,
    '--bio-color': typography.bioColor,
    '--overlay-color': appearance.effects.overlay.color,
    '--overlay-opacity': String(appearance.effects.overlay.intensity / 400),
    '--glitch-period': 12 - appearance.effects.overlay.intensity * 0.085 + 's',
    '--click-color': appearance.effects.click.color,
    '--sparkle-color': appearance.effects.sparkles.color,
    '--profile-align': typography.align,
    '--card-width': card.width + 'px',
    '--card-padding': card.padding + 'px',
    '--card-bg': card.color + alphaHex(card.opacity),
    '--card-blur': card.blur + 'px',
    '--card-radius': card.radius + 'px',
    '--card-border': card.border + 'px',
    '--card-line': card.borderColor,
    '--card-shadow': shadow[card.shadow],
    '--avatar-size': avatar.size + 'px',
    '--link-bg': links.color,
    '--link-text': links.text,
    '--link-radius': links.radius + 'px',
    '--link-border': links.border + 'px',
    '--link-line': links.borderColor,
    '--link-shadow': shadow[links.shadow],
    '--link-height': links.height + 'px',
    '--link-gap': links.gap + 'px',
    '--footer-bg': card.color,
    '--footer-ink': accentInk(card.color),
  }
}

export function imageVariable(url: string) {
  return 'url("' + url + '")'
}
