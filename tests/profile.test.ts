import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { siteFiles } from '../src/export/site'
import { demoProfile } from '../src/profile/demo'
import { presetAppearance, presetNames } from '../src/profile/appearance'
import {
  editableText,
  limits,
  parseProfile,
  parseTheme,
  profileVersion,
  themeVersion,
  validUrl,
} from '../src/profile/document'
import { checkImageSize } from '../src/profile/image-size'
import { accentInk } from '../src/profile/colors'

const samplePng = readFileSync(
  new URL('../src/assets/mira-park.png', import.meta.url),
)
const emptyAssets = {
  css: '.public-profile{display:block}',
  fontCss: '@font-face{src:url(./files/manrope-latin-wght-normal.woff2)}',
  fonts: {
    'manrope-latin-wght-normal.woff2': new Uint8Array(),
    'manrope-cyrillic-wght-normal.woff2': new Uint8Array(),
  },
  fontLicense: new Uint8Array(),
  lucideLicense: 'Lucide license',
  fontAwesomeLicense: 'Font Awesome Brands license',
}

describe('Rvnce profile documents', () => {
  it('keeps v5 effects and v2 theme styles when name motion is added', () => {
    const doc = demoProfile(null)
    const { nameMotion, ...oldEffects } = doc.appearance.effects
    expect(nameMotion.preset).toBe('none')
    oldEffects.name = { enabled: true, preset: 'gradient' }
    oldEffects.cursor.preset = 'crosshair'
    const appearance = { ...doc.appearance, effects: oldEffects }
    const profile = parseProfile(
      JSON.stringify({ ...doc, schemaVersion: 5, appearance }),
    )
    const theme = parseTheme(
      JSON.stringify({ type: 'rvnce-theme', schemaVersion: 2, appearance }),
    )
    for (const restored of [profile, theme]) {
      expect(restored.appearance.effects.name).toEqual(oldEffects.name)
      expect(restored.appearance.effects.cursor.preset).toBe('crosshair')
      expect(restored.appearance.effects.nameMotion.preset).toBe('none')
    }
  })

  it('round-trips a profile and raster avatar', () => {
    const doc = demoProfile(samplePng.toString('base64'))
    doc.profile.name = 'Мира Пак'
    expect(parseProfile(JSON.stringify(doc))).toEqual(doc)
  })

  it('preserves incomplete drafts while requiring valid imports and exports', () => {
    const doc = demoProfile(null)
    doc.profile.name = ''
    doc.blocks[0]!.url = 'ht'
    const raw = JSON.stringify(doc)
    expect(parseProfile(raw, 'draft')).toEqual(doc)
    expect(() => parseProfile(raw)).toThrow('complete every link')
  })

  it('rejects broken JSON, unsupported versions, oversized payloads, and unknown keys', () => {
    expect(() => parseProfile('{')).toThrow('valid JSON')
    expect(() =>
      parseProfile(
        JSON.stringify({
          ...demoProfile(null),
          schemaVersion: profileVersion + 1,
        }),
      ),
    ).toThrow('unsupported')
    expect(() => parseProfile('x'.repeat(limits.documentBytes + 1))).toThrow(
      'smaller',
    )
    expect(() =>
      parseProfile(JSON.stringify({ ...demoProfile(null), snippet: '' })),
    ).toThrow('profile format')
  })

  it('rejects duplicate block IDs, invalid accents and non-PNG avatars', () => {
    const doc = demoProfile(null)
    doc.blocks.push({ ...doc.blocks[0]! })
    expect(() => parseProfile(JSON.stringify(doc))).toThrow('link block')
    doc.blocks.pop()
    expect(() =>
      parseProfile(
        JSON.stringify({
          ...doc,
          appearance: { ...doc.appearance, accent: '#123;' },
        }),
      ),
    ).toThrow('appearance')
    doc.profile.avatar = btoa('invalid raster data')
    expect(() => parseProfile(JSON.stringify(doc))).toThrow('supported PNG')
  })

  it.each([
    'javascript:foo',
    'data:text/html,hi',
    '//example.org',
    'https://user:pass@example.org',
    'https://exa mple.org',
    'https://example.org\\test',
  ])('rejects unsafe or malformed URL %s', (url) => {
    expect(validUrl(url)).toBe(false)
  })

  it('accepts full HTTP and HTTPS URLs', () => {
    expect(validUrl('http://example.org')).toBe(true)
    expect(validUrl('https://example.org/a%20b?x=1#test')).toBe(true)
  })

  it('upgrades legacy documents and recovers text written by older editors', () => {
    const legacy = {
      schemaVersion: 1,
      profile: { name: 'Mira', bio: 'First\fSecond', avatar: null },
      appearance: { theme: 'rvnce', variant: 'light', accent: '#4434d4' },
      blocks: [],
    }
    const raw = JSON.stringify(legacy)
    expect(() => parseProfile(raw, 'draft')).toThrow('profile details')
    expect(parseProfile(raw, 'recover')).toMatchObject({
      schemaVersion: profileVersion,
      profile: { name: 'Mira', bio: 'First\nSecond', language: 'en' },
      branding: { showMadeWithRvnce: false },
    })
    expect(editableText('First\fSecond', true)).toBe('First\nSecond')
    legacy.profile.bio = 'Valid legacy bio'
    expect(parseProfile(JSON.stringify(legacy)).profile.language).toBe('en')
  })

  it('requires a well-formed language for a published profile', () => {
    const doc = demoProfile(null)
    doc.profile.language = 'pt_BR'
    const raw = JSON.stringify(doc)
    expect(parseProfile(raw, 'draft')).toEqual(doc)
    expect(() => parseProfile(raw)).toThrow('language tag')
  })

  it('migrates a v2 profile without the credit and preserves its graphic palette', () => {
    const legacy = {
      schemaVersion: 2,
      profile: { name: 'Legacy', bio: '', avatar: null, language: 'ru' },
      appearance: { theme: 'rvnce', variant: 'dark', accent: '#efaa3c' },
      blocks: [],
    }
    const doc = parseProfile(JSON.stringify(legacy))
    expect(doc).toMatchObject({
      schemaVersion: profileVersion,
      profile: { language: 'ru' },
      appearance: {
        preset: 'graphic',
        variant: 'dark',
        accent: '#efaa3c',
        links: { style: 'graphic', color: '#efaa3c', text: '#000000' },
      },
      branding: { showMadeWithRvnce: false },
    })
    expect(siteFiles(doc, emptyAssets)['index.html']).not.toContain(
      'Made with Rvnce',
    )
  })

  it('migrates v3 branding and validates a standalone favicon', () => {
    const doc = demoProfile(null)
    const { effects, ...legacyAppearance } = doc.appearance
    const previous = {
      ...doc,
      schemaVersion: 3,
      appearance: legacyAppearance,
      branding: { showMadeWithRvnce: true },
    }
    expect(parseProfile(JSON.stringify(previous))).toEqual(doc)
    expect(
      parseProfile(
        JSON.stringify({
          ...doc,
          schemaVersion: 4,
          appearance: legacyAppearance,
        }),
      ).appearance.effects,
    ).toEqual(effects)
    expect(
      parseTheme(
        JSON.stringify({
          type: 'rvnce-theme',
          schemaVersion: 1,
          appearance: legacyAppearance,
        }),
      ).appearance.effects,
    ).toEqual(effects)
    expect(siteFiles(doc, emptyAssets)['favicon.png']).toBeUndefined()

    const icon = readFileSync(
      new URL('../src/assets/rvnce-mark.png', import.meta.url),
    )
    doc.branding.favicon = icon.toString('base64')
    const profile = parseProfile(JSON.stringify(doc))
    const files = siteFiles(profile, emptyAssets)
    expect(files['favicon.png']).toEqual(new Uint8Array(icon))
    expect(files['index.html']).toContain(
      'rel="icon" type="image/png" href="./favicon.png"',
    )
    expect(files['avatar.png']).toBeUndefined()

    const wrongSize = Buffer.from(icon)
    wrongSize.writeUInt32BE(32, 16)
    doc.branding.favicon = wrongSize.toString('base64')
    expect(() => parseProfile(JSON.stringify(doc))).toThrow('64 × 64')
    doc.branding.favicon = samplePng.toString('base64')
    expect(() => parseProfile(JSON.stringify(doc))).toThrow('supported PNG')
    doc.branding.favicon = btoa('not a PNG')
    expect(() => parseProfile(JSON.stringify(doc))).toThrow('supported PNG')
  })

  it.each(presetNames)(
    'round-trips %s as a theme with independent settings',
    (name) => {
      const appearance = presetAppearance(name)
      const theme = {
        type: 'rvnce-theme',
        schemaVersion: themeVersion,
        appearance,
      }
      expect(parseTheme(JSON.stringify(theme))).toEqual(theme)
      appearance.card.radius = 45
      expect(presetAppearance(name).card.radius).not.toBe(45)
    },
  )

  it.each([
    { background: { color: '#000000;position:fixed' } },
    { background: { scale: 200 } },
    { background: { kind: 'media' } },
    { typography: { font: 'url(test)' } },
    { card: { opacity: -1 } },
    { avatar: { shape: 'polygon' } },
    { links: { gap: 3.5 } },
    { effects: { click: { preset: 'unknown', color: '#ffffff' } } },
    {
      effects: {
        overlay: { preset: 'snow', color: '#ffffff', intensity: 101 },
      },
    },
    { effects: { cursor: { preset: 'custom', image: 'aGVsbG8=' } } },
  ])('rejects unsafe or out-of-range theme overrides %j', (override) => {
    const appearance = presetAppearance('minimal')
    const [group, edits] = Object.entries(override)[0]!
    const base = appearance[group as keyof typeof appearance] as object
    expect(() =>
      parseTheme(
        JSON.stringify({
          type: 'rvnce-theme',
          schemaVersion: themeVersion,
          appearance: { ...appearance, [group]: { ...base, ...edits } },
        }),
      ),
    ).toThrow()
  })

  it('chooses legible ink on dark, light and midtone accents', () => {
    expect(accentInk('#000000')).toBe('#ffffff')
    expect(accentInk('#ffffff')).toBe('#000000')
    expect(accentInk('#757575')).toBe('#ffffff')
    expect(accentInk('#767676')).toBe('#000000')
  })
})

describe('standalone public site', () => {
  it('serializes safe text, relative resources, an avatar and the required files', () => {
    const doc = demoProfile(samplePng.toString('base64'))
    doc.profile.name = '<em>Mira & Co</em>'
    doc.profile.language = 'PT-br'
    doc.profile.bio = 'Photo by "Mira".'
    doc.blocks[0]!.url = 'https://www.are.na/?a=1&b=2'
    const files = siteFiles(doc, emptyAssets)
    const zip = zipSync(
      Object.fromEntries(
        Object.entries(files).map(([name, contents]) => [
          name,
          typeof contents === 'string' ? strToU8(contents) : contents,
        ]),
      ),
    )
    const unpacked = unzipSync(zip)
    expect(Object.keys(unpacked).sort()).toEqual([
      '.nojekyll',
      'avatar.png',
      'fonts/OFL.txt',
      'fonts/manrope-cyrillic.woff2',
      'fonts/manrope-latin.woff2',
      'icons/Font-Awesome-LICENSE.txt',
      'icons/Lucide-LICENSE.txt',
      'index.html',
      'profile.css',
    ])
    const html = strFromU8(unpacked['index.html']!)
    expect(html).toContain('<html lang="pt-BR">')
    expect(html).toMatch(/&lt;em(?:>|&gt;)Mira &amp; Co&lt;\/em(?:>|&gt;)/u)
    expect(html).not.toContain('<em>')
    expect(html).toContain('Photo by &quot;Mira&quot;.')
    expect(html).toContain('https://www.are.na/?a=1&amp;b=2')
    expect(html).toContain('href="./profile.css"')
    expect(html).toContain('src="./avatar.png"')
    expect(html).not.toContain('<script')
    expect(html).toContain('href="https://sinzbtw.github.io/rvnce/"')
    expect(html).toContain('Made with Rvnce')
    expect(strFromU8(unpacked['profile.css']!)).toContain(
      './fonts/manrope-latin.woff2',
    )
    expect(unpacked['avatar.png']).toEqual(Uint8Array.from(samplePng))
    expect(strFromU8(unpacked['icons/Lucide-LICENSE.txt']!)).toBe(
      emptyAssets.lucideLicense,
    )
    expect(strFromU8(unpacked['icons/Font-Awesome-LICENSE.txt']!)).toBe(
      emptyAssets.fontAwesomeLicense,
    )
  })

  it('omits an absent avatar and renders initials', () => {
    const files = siteFiles(demoProfile(null), emptyAssets)
    expect(files['avatar.png']).toBeUndefined()
    expect(files['index.html']).toContain('>S</span>')
  })

  it('loads the local pointer script only for pointer effects', () => {
    const doc = demoProfile(null)
    doc.appearance.effects.trail = 'ghost'
    const assets = { ...emptyAssets, pointerScript: '/* pointer effects */' }
    const files = siteFiles(doc, assets)
    expect(files['index.html']).toContain('src="./pointer-effects.js"')
    expect(files['index.html']).toContain('data-trail="ghost"')
    expect(files['pointer-effects.js']).toBe(assets.pointerScript)
    doc.appearance.effects.trail = 'none'
    doc.appearance.effects.overlay.preset = 'grain'
    expect(siteFiles(doc, assets)['pointer-effects.js']).toBeUndefined()
  })

  it('rejects unvalidated custom icons and detects only supported hostnames', () => {
    const doc = demoProfile(null)
    doc.blocks.push({
      type: 'icon',
      id: 'social',
      label: 'My website',
      url: 'https://github.com.example.org/',
      icon: 'auto',
      image: null,
      tint: false,
    })
    expect(parseProfile(JSON.stringify(doc))).toEqual(doc)
    expect(siteFiles(doc, emptyAssets)['index.html']).toContain('lucide-globe')
    doc.blocks[3] = {
      type: 'icon',
      id: 'social',
      label: 'Custom',
      url: 'https://example.org/',
      icon: 'custom',
      image: samplePng.toString('base64'),
      tint: false,
    }
    expect(() => parseProfile(JSON.stringify(doc))).toThrow('custom link icon')
  })
})

describe('avatar upload dimensions', () => {
  it('accepts supported raster headers and rejects oversized or truncated ones', () => {
    const png = Uint8Array.from(samplePng.slice(0, 24))
    const jpeg = Uint8Array.from([
      0xff, 0xd8, 0xff, 0xc0, 0, 8, 8, 1, 128, 1, 128, 1,
    ])
    const webp = Uint8Array.from([
      ...'RIFF'.split('').map((character) => character.charCodeAt(0)),
      22,
      0,
      0,
      0,
      ...'WEBPVP8X'.split('').map((character) => character.charCodeAt(0)),
      10,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      127,
      1,
      0,
      127,
      1,
      0,
    ])
    for (const image of [png, jpeg, webp]) {
      expect(() => checkImageSize(image.buffer)).not.toThrow()
      expect(() => checkImageSize(image.slice(0, 10).buffer)).toThrow(
        'readable',
      )
    }
    const size = new DataView(png.buffer)
    size.setUint32(16, 6000)
    size.setUint32(20, 4001)
    expect(() => checkImageSize(png.buffer)).toThrow('24 megapixels')
  })
})
