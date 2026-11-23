import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { siteFiles } from '../src/export/site'
import { demoProfile } from '../src/profile/demo'
import {
  editableText,
  limits,
  parseProfile,
  validUrl,
} from '../src/profile/document'
import { checkImageSize } from '../src/editor/image-size'
import { accentInk } from '../src/public/colors'

const samplePng = readFileSync(
  new URL('../src/assets/mira-park.png', import.meta.url),
)
const emptyAssets = {
  css: '.public-profile{display:block}',
  latinFont: new Uint8Array(),
  cyrillicFont: new Uint8Array(),
  fontLicense: new Uint8Array(),
}

describe('Rvnce profile documents', () => {
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
      parseProfile(JSON.stringify({ ...demoProfile(null), schemaVersion: 3 })),
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
      ...demoProfile(null),
      schemaVersion: 1,
      profile: { name: 'Mira', bio: 'First\fSecond', avatar: null },
    }
    const raw = JSON.stringify(legacy)
    expect(() => parseProfile(raw, 'draft')).toThrow('profile details')
    expect(parseProfile(raw, 'recover')).toMatchObject({
      schemaVersion: 2,
      profile: { name: 'Mira', bio: 'First\nSecond', language: 'en' },
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
    expect(strFromU8(unpacked['profile.css']!)).toContain(
      './fonts/manrope-latin.woff2',
    )
    expect(unpacked['avatar.png']).toEqual(Uint8Array.from(samplePng))
  })

  it('omits an absent avatar and renders initials', () => {
    const files = siteFiles(demoProfile(null), emptyAssets)
    expect(files['avatar.png']).toBeUndefined()
    expect(files['index.html']).toContain('>MP</span>')
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
