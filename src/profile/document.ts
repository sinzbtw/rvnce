export const limits = {
  name: 80,
  bio: 420,
  label: 80,
  url: 2048,
  blocks: 24,
  avatarEdge: 384,
  avatarBytes: 768 * 1024,
  uploadBytes: 4 * 1024 * 1024,
  documentBytes: 1250 * 1024,
}

export const defaultAccent = '#4434d4'

export interface LinkBlock {
  id: string
  type: 'link'
  label: string
  url: string
}

export interface ProfileDocument {
  schemaVersion: 1
  profile: { name: string; bio: string; avatar: string | null }
  appearance: { theme: 'rvnce'; variant: 'light' | 'dark'; accent: string }
  blocks: LinkBlock[]
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasKeys(
  value: unknown,
  keys: string[],
): value is Record<string, unknown> {
  return (
    record(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  )
}

// eslint-disable-next-line no-control-regex -- Reject unprintable characters in imported fields.
const unprintable = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u

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

export function avatarBytes(encoded: string): Uint8Array<ArrayBuffer> {
  if (
    encoded.length > Math.ceil(limits.avatarBytes / 3) * 4 ||
    !/^[A-Za-z0-9+/]+={0,2}$/u.test(encoded) ||
    encoded.length % 4 !== 0
  ) {
    throw new Error('The avatar is not a supported PNG.')
  }
  const png = Uint8Array.from(atob(encoded), (character) =>
    character.charCodeAt(0),
  )
  const signature = [
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
  ]
  if (
    png.length < 45 ||
    png.length > limits.avatarBytes ||
    signature.some((byte, i) => png[i] !== byte)
  ) {
    throw new Error('The avatar is not a supported PNG.')
  }
  const header = new DataView(png.buffer)
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
  return png
}

export function profileIssues(doc: ProfileDocument) {
  return {
    name: doc.profile.name.trim() ? '' : 'Enter a display name.',
    blocks: doc.blocks.map((block) => ({
      label: block.label.trim() ? '' : 'Enter a link label.',
      url: validUrl(block.url) ? '' : 'Enter a full HTTP or HTTPS URL.',
    })),
  }
}

export function parseProfile(raw: string, allowDraft = false): ProfileDocument {
  if (new TextEncoder().encode(raw).length > limits.documentBytes) {
    throw new Error('Choose a Rvnce JSON file smaller than 1.2 MB.')
  }
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    throw new Error('This file does not contain valid JSON.')
  }
  if (!record(value) || value.schemaVersion !== 1) {
    throw new Error('This Rvnce profile version is unsupported.')
  }
  if (!hasKeys(value, ['schemaVersion', 'profile', 'appearance', 'blocks'])) {
    throw new Error('This file does not match the Rvnce profile format.')
  }

  const { profile, appearance, blocks } = value
  if (
    !hasKeys(profile, ['name', 'bio', 'avatar']) ||
    !text(profile.name, limits.name) ||
    !text(profile.bio, limits.bio) ||
    (profile.avatar !== null && typeof profile.avatar !== 'string')
  ) {
    throw new Error('The profile details are invalid.')
  }
  if (profile.avatar !== null) avatarBytes(profile.avatar)
  if (
    !hasKeys(appearance, ['theme', 'variant', 'accent']) ||
    appearance.theme !== 'rvnce' ||
    (appearance.variant !== 'light' && appearance.variant !== 'dark') ||
    typeof appearance.accent !== 'string' ||
    !/^#[0-9a-f]{6}$/i.test(appearance.accent)
  ) {
    throw new Error('The profile appearance is invalid.')
  }
  if (!Array.isArray(blocks) || blocks.length > limits.blocks) {
    throw new Error('The profile must have at most 24 links.')
  }

  const identifiers = new Set<string>()
  const parsedBlocks = blocks.map((block: unknown): LinkBlock => {
    if (
      !hasKeys(block, ['type', 'id', 'label', 'url']) ||
      block.type !== 'link' ||
      typeof block.id !== 'string' ||
      !/^[a-z0-9_-]{1,80}$/i.test(block.id) ||
      identifiers.has(block.id) ||
      !text(block.label, limits.label) ||
      !text(block.url, limits.url)
    ) {
      throw new Error('A link block is invalid.')
    }
    identifiers.add(block.id)
    return { id: block.id, type: 'link', label: block.label, url: block.url }
  })
  const doc: ProfileDocument = {
    schemaVersion: 1,
    profile: { name: profile.name, bio: profile.bio, avatar: profile.avatar },
    appearance: {
      theme: 'rvnce',
      variant: appearance.variant,
      accent: appearance.accent,
    },
    blocks: parsedBlocks,
  }
  if (!allowDraft) {
    const issues = profileIssues(doc)
    if (issues.name || issues.blocks.some(({ label, url }) => label || url)) {
      throw new Error(
        'Enter a name and complete every link before exporting or importing.',
      )
    }
  }
  return doc
}
