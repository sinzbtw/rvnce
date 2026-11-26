import type { CursorPreset } from '../profile/effects'

const artwork = {
  pixel: {
    anchor: [3, 2],
    paths:
      '<path d="M3 2h2v2h2v2h2v2h2v2h2v2h2v3h-5l3 6-3 1-3-6H5l-2 2z" fill="#fff5dc" stroke="#1c1825" stroke-width="2" stroke-linejoin="round"/>',
  },
  neon: {
    anchor: [3, 3],
    paths:
      '<path d="M3 3l17 9-8 2-3 7z" fill="#142b29" stroke="#233035" stroke-width="4" stroke-linejoin="round"/><path d="M3 3l17 9-8 2-3 7z" fill="#182d2b" stroke="#85ffdc" stroke-width="1.8" stroke-linejoin="round"/><path d="m8 8 6 3-3 1-1 3z" fill="#d9fff2"/>',
  },
  reticle: {
    anchor: [12, 12],
    paths:
      '<path d="M12 2v5m0 10v5M2 12h5m10 0h5" stroke="#202229" stroke-width="4" stroke-linecap="round"/><circle cx="12" cy="12" r="7" fill="none" stroke="#202229" stroke-width="3"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5" stroke="#f8f9ff" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="12" r="7" fill="none" stroke="#f8f9ff" stroke-width="1"/><circle cx="12" cy="12" r="1.5" fill="#ff805a" stroke="#202229"/>',
  },
} as const

export function cursorArt(preset: CursorPreset) {
  if (!Object.hasOwn(artwork, preset)) return
  const { anchor, paths } = artwork[preset as keyof typeof artwork]
  return {
    anchor,
    path: 'cursors/' + preset + '.svg',
    svg:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">' +
      paths +
      '</svg>',
  }
}
