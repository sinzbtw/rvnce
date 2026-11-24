import {
  parseAppearance,
  presetAppearance,
  type Appearance,
} from './appearance'
import { accentInk } from './colors'
import { hasKeys, isHex, record } from './shape'

export const officialEditor = 'https://sinzbtw.github.io/rvnce/'

export const limits = {
  name: 80,
  bio: 420,
  language: 63,
  label: 80,
  url: 2048,
  blocks: 24,
  avatarEdge: 384,
  avatarBytes: 768 * 1024,
  uploadBytes: 4 * 1024 * 1024,
  uploadPixels: 24_000_000,
  uploadEdge: 8192,
  documentBytes: 16 * 1024 * 1024,
}

export interface LinkBlock {
  id: string
  type: 'link'
  label: string
  url: string
}

export interface ProfileDocument {
  schemaVersion: 3
  profile: {
    name: string
    bio: string
    avatar: string | null
    language: string
  }
  appearance: Appearance
  branding: { showMadeWithRvnce: boolean }
  blocks: LinkBlock[]
}

export interface ThemeDocument {
  type: 'rvnce-theme'
  schemaVersion: 1
  appearance: Appearance
}

// eslint-disable-next-line no-control-regex -- Reject unprintable characters in imported fields.
const unprintable = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u
const unprintableCharacters = new RegExp(unprintable.source, 'gu')

export function editableText(value: string, multiline = false): string {
  return value
    .replaceAll('\f', multiline ? '\n' : ' ')
    .replace(unprintableCharacters, '')
}

export function profileLanguage(value: string): string | undefined {
  const tag = value.trim()
  if (tag.length > limits.language || !/^[a-z0-9-]+$/i.test(tag)) return
  try {
    return Intl.getCanonicalLocales(tag)[0]
  } catch {
    return undefined
  }
}

function text(value: unknown, max: number): value is string {
  return (
    typeof value === 'string' && value.length <= max && !unprintable.test(value)
  )
}

export function validUrl(input: string): boolean {
  if (!/^https?:\/\//i.test(input.trim()) || /[\s\\]/u.test(input.trim()))
    return false
  try {
    const url = new URL(input.trim())
    return !url.username && !url.password
  } catch {
    return false
  }
}

function validateAvatar(encoded: string): void {
  if (
    encoded.length > Math.ceil(limits.avatarBytes / 3) * 4 ||
    !/^[A-Za-z0-9+/]+={0,2}$/u.test(encoded) ||
    encoded.length % 4 !== 0
  ) {
    throw new Error('The avatar is not a supported PNG.')
  }
  const padding = encoded.endsWith('==') ? 2 : Number(encoded.endsWith('='))
  const length = (encoded.length / 4) * 3 - padding
  const headerBytes = Uint8Array.from(atob(encoded.slice(0, 32)), (character) =>
    character.charCodeAt(0),
  )
  const signature = [
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
  ]
  if (
    length < 45 ||
    length > limits.avatarBytes ||
    signature.some((byte, i) => headerBytes[i] !== byte)
  ) {
    throw new Error('The avatar is not a supported PNG.')
  }
  const header = new DataView(headerBytes.buffer)
  const width = header.getUint32(16)
  const height = header.getUint32(20)
  if (
    !width ||
    !height ||
    width > limits.avatarEdge ||
    height > limits.avatarEdge
  ) {
    throw new Error('The avatar must fit within 384 × 384 pixels.')
  }
}

export function avatarBytes(encoded: string): Uint8Array<ArrayBuffer> {
  validateAvatar(encoded)
  return Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))
}

export function profileIssues(doc: ProfileDocument) {
  return {
    name: doc.profile.name.trim() ? '' : 'Enter a display name.',
    language: profileLanguage(doc.profile.language)
      ? ''
      : 'Enter a language tag, such as en or ru.',
    blocks: doc.blocks.map((block) => ({
      label: block.label.trim() ? '' : 'Enter a link label.',
      url: validUrl(block.url) ? '' : 'Enter a full HTTP or HTTPS URL.',
    })),
  }
}

function readJson(raw: string): unknown {
  if (
    raw.length > limits.documentBytes ||
    (raw.length > limits.documentBytes / 3 &&
      new Blob([raw]).size > limits.documentBytes)
  ) {
    throw new Error('Choose a Rvnce JSON file smaller than 16 MiB.')
  }
  try {
    return JSON.parse(raw) as unknown
  } catch {
    throw new Error('This file does not contain valid JSON.')
  }
}

export function parseTheme(raw: string): ThemeDocument {
  const value = readJson(raw)
  if (
    !hasKeys(value, ['type', 'schemaVersion', 'appearance']) ||
    value.type !== 'rvnce-theme' ||
    value.schemaVersion !== 1
  ) {
    throw new Error('Choose a supported Rvnce theme JSON.')
  }
  return {
    type: 'rvnce-theme',
    schemaVersion: 1,
    appearance: parseAppearance(value.appearance),
  }
}

export function parseProfile(
  raw: string,
  mode: 'publish' | 'draft' | 'recover' = 'publish',
): ProfileDocument {
  return validateProfile(readJson(raw), mode)
}

export function validateProfile(
  value: unknown,
  mode: 'publish' | 'draft' | 'recover' = 'publish',
): ProfileDocument {
  if (
    !record(value) ||
    (value.schemaVersion !== 1 &&
      value.schemaVersion !== 2 &&
      value.schemaVersion !== 3)
  ) {
    throw new Error('This Rvnce profile version is unsupported.')
  }
  const version = value.schemaVersion
  const keys = ['schemaVersion', 'profile', 'appearance', 'blocks']
  if (version === 3) keys.push('branding')
  if (!hasKeys(value, keys)) {
    throw new Error('This file does not match the Rvnce profile format.')
  }

  const { profile, appearance, blocks } = value
  const profileKeys = ['name', 'bio', 'avatar']
  if (version !== 1) profileKeys.push('language')
  const field = (input: unknown, multiline = false): unknown =>
    mode === 'recover' && typeof input === 'string'
      ? editableText(input, multiline)
      : input
  if (!hasKeys(profile, profileKeys)) {
    throw new Error('The profile details are invalid.')
  }
  const name = field(profile.name)
  const bio = field(profile.bio, true)
  const language = version === 1 ? 'en' : field(profile.language)
  if (
    !text(name, limits.name) ||
    !text(bio, limits.bio) ||
    !text(language, limits.language) ||
    (profile.avatar !== null && typeof profile.avatar !== 'string')
  ) {
    throw new Error('The profile details are invalid.')
  }
  if (profile.avatar !== null) validateAvatar(profile.avatar)
  let parsedAppearance: Appearance
  let showMadeWithRvnce = false
  if (version === 3) {
    parsedAppearance = parseAppearance(appearance)
    if (
      !hasKeys(value.branding, ['showMadeWithRvnce']) ||
      typeof value.branding.showMadeWithRvnce !== 'boolean'
    ) {
      throw new Error('The profile branding is invalid.')
    }
    showMadeWithRvnce = value.branding.showMadeWithRvnce
  } else {
    if (
      !hasKeys(appearance, ['theme', 'variant', 'accent']) ||
      appearance.theme !== 'rvnce' ||
      (appearance.variant !== 'light' && appearance.variant !== 'dark') ||
      !isHex(appearance.accent)
    ) {
      throw new Error('The profile appearance is invalid.')
    }
    parsedAppearance = {
      ...presetAppearance('graphic', appearance.variant),
      accent: appearance.accent,
    }
    parsedAppearance.links.color = appearance.accent
    parsedAppearance.links.text = accentInk(appearance.accent)
  }
  if (!Array.isArray(blocks) || blocks.length > limits.blocks) {
    throw new Error('The profile must have at most 24 links.')
  }

  const identifiers = new Set<string>()
  const parsedBlocks = blocks.map((block: unknown): LinkBlock => {
    if (!hasKeys(block, ['type', 'id', 'label', 'url'])) {
      throw new Error('A link block is invalid.')
    }
    const label = field(block.label)
    const url = field(block.url)
    if (
      block.type !== 'link' ||
      typeof block.id !== 'string' ||
      !/^[a-z0-9_-]{1,80}$/i.test(block.id) ||
      identifiers.has(block.id) ||
      !text(label, limits.label) ||
      !text(url, limits.url)
    ) {
      throw new Error('A link block is invalid.')
    }
    identifiers.add(block.id)
    return { id: block.id, type: 'link', label, url }
  })
  const doc: ProfileDocument = {
    schemaVersion: 3,
    profile: { name, bio, avatar: profile.avatar, language },
    appearance: parsedAppearance,
    branding: { showMadeWithRvnce },
    blocks: parsedBlocks,
  }
  if (mode === 'publish') {
    const issues = profileIssues(doc)
    if (issues.name || issues.blocks.some(({ label, url }) => label || url)) {
      throw new Error('Enter a name and complete every link before publishing.')
    }
    if (issues.language) throw new Error(issues.language)
  }
  return doc
}
