import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { siteFiles } from '../src/export/site'
import { demoProfile } from '../src/profile/demo'
import { limits, parseProfile, validUrl } from '../src/profile/document'
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

describe('Rvnce profile v1', () => {
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
    expect(parseProfile(raw, true)).toEqual(doc)
    expect(() => parseProfile(raw)).toThrow('complete every link')
  })

  it('rejects broken JSON, unsupported versions, oversized payloads, and unknown keys', () => {
    expect(() => parseProfile('{')).toThrow('valid JSON')
    expect(() =>
      parseProfile(JSON.stringify({ ...demoProfile(null), schemaVersion: 2 })),
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
