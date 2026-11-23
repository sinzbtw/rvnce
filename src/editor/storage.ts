import { parseProfile, type ProfileDocument } from '../profile/document'

const draftKey = 'rvnce.draft.v1'

export type DraftStatus = 'ready' | 'saved' | 'unavailable' | 'invalid'

export function readDraft(): {
  doc: ProfileDocument | null
  status: DraftStatus
} {
  let content: string | null
  try {
    content = localStorage.getItem(draftKey)
  } catch {
    return { doc: null, status: 'unavailable' }
  }
  if (content === null) return { doc: null, status: 'ready' }
  try {
    return { doc: parseProfile(content, true), status: 'saved' }
  } catch {
    return { doc: null, status: 'invalid' }
  }
}

export function saveDraft(doc: ProfileDocument): DraftStatus {
  try {
    localStorage.setItem(draftKey, JSON.stringify(doc))
    return 'saved'
  } catch {
    return 'unavailable'
  }
}
