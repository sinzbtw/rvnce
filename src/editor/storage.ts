import { parseProfile, type ProfileDocument } from '../profile/document'

export const draftKey = 'rvnce.draft.v1'

export interface StoredDraft {
  doc: ProfileDocument | null
  content: string | null
  status: 'ready' | 'saved' | 'unavailable' | 'invalid' | 'recovered'
}

export function readDraft(): StoredDraft {
  let content: string | null
  try {
    content = localStorage.getItem(draftKey)
  } catch {
    return { doc: null, content: null, status: 'unavailable' }
  }
  if (content === null) return { doc: null, content, status: 'ready' }
  try {
    return { doc: parseProfile(content, 'draft'), content, status: 'saved' }
  } catch {
    try {
      return {
        doc: parseProfile(content, 'recover'),
        content,
        status: 'recovered',
      }
    } catch {
      return { doc: null, content, status: 'invalid' }
    }
  }
}

export function saveDraft(doc: ProfileDocument, expected: string | null) {
  const content = JSON.stringify(doc)
  try {
    parseProfile(content, 'draft')
  } catch {
    return { status: 'invalid-edit' } as const
  }
  try {
    if (localStorage.getItem(draftKey) !== expected) {
      return { status: 'conflict' } as const
    }
    localStorage.setItem(draftKey, content)
    return { status: 'saved', content } as const
  } catch {
    return { status: 'unavailable' } as const
  }
}
