import {
  parseProfile,
  validateProfile,
  type ProfileDocument,
} from '../profile/document'
import type { BackgroundMedia } from '../profile/media'
import { record } from '../profile/shape'

export const draftKey = 'rvnce.draft.v1'
export const draftChannel = 'rvnce.draft.changed'
const storeName = 'workspace'

export interface StoredDraft {
  doc: ProfileDocument | null
  revision: string | null
  content: string | null
  status: 'ready' | 'saved' | 'unavailable' | 'invalid' | 'recovered'
}

interface DraftRecord {
  revision: string
  doc: ProfileDocument
}

let connection: Promise<IDBDatabase> | undefined

function database() {
  if (connection) return connection
  connection = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('rvnce', 1)
    let expired = false
    const timer = window.setTimeout(() => {
      expired = true
      reject(new Error('Storage could not be opened.'))
    }, 2000)
    request.onupgradeneeded = () => request.result.createObjectStore(storeName)
    request.onerror = () => {
      window.clearTimeout(timer)
      reject(request.error)
    }
    request.onsuccess = () => {
      window.clearTimeout(timer)
      if (expired) {
        request.result.close()
        return
      }
      request.result.onversionchange = () => {
        request.result.close()
        connection = undefined
      }
      resolve(request.result)
    }
  }).catch((error: unknown) => {
    connection = undefined
    throw error
  })
  return connection
}

function result<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function complete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error)
    transaction.onerror = () => reject(transaction.error)
  })
}

function legacyContent(): string | null {
  try {
    return localStorage.getItem(draftKey)
  } catch {
    return null
  }
}

function readLegacy(): StoredDraft {
  const content = legacyContent()
  if (content === null)
    return { doc: null, revision: null, content, status: 'ready' }
  const revision = 'legacy:' + content
  try {
    return {
      doc: parseProfile(content, 'draft'),
      revision,
      content: null,
      status: 'saved',
    }
  } catch {
    try {
      return {
        doc: parseProfile(content, 'recover'),
        revision,
        content: null,
        status: 'recovered',
      }
    } catch {
      return { doc: null, revision, content, status: 'invalid' }
    }
  }
}

export async function readDraft(): Promise<StoredDraft> {
  let saved: unknown
  let media: unknown
  try {
    const db = await database()
    const store = db.transaction(storeName).objectStore(storeName)
    ;[saved, media] = await Promise.all([
      result(store.get('draft')),
      result(store.get('background')),
    ])
  } catch {
    const old = readLegacy()
    return {
      ...old,
      status: old.status === 'invalid' ? 'invalid' : 'unavailable',
    }
  }
  if (saved === undefined) return readLegacy()

  const revision =
    record(saved) && typeof saved.revision === 'string'
      ? saved.revision
      : 'unreadable'
  let doc: unknown = record(saved) ? saved.doc : saved
  if (
    record(doc) &&
    record(doc.appearance) &&
    record(doc.appearance.background)
  ) {
    doc = {
      ...doc,
      appearance: {
        ...doc.appearance,
        background: { ...doc.appearance.background, media: media ?? null },
      },
    }
  }
  try {
    return {
      doc: validateProfile(doc, 'draft'),
      revision,
      content: null,
      status: 'saved',
    }
  } catch {
    return {
      doc: null,
      revision,
      content: JSON.stringify(doc) ?? null,
      status: 'invalid',
    }
  }
}

export async function saveDraft(
  doc: ProfileDocument,
  expected: string | null,
  priorMedia: BackgroundMedia | null,
) {
  try {
    const db = await database()
    const transaction = db.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const done = complete(transaction)
    let next: string | null = null
    // Keep the compare and writes inside the request callback so Safari can't auto-close the transaction.
    const current = store.get('draft') as IDBRequest<unknown>
    current.onsuccess = () => {
      const saved = current.result
      const legacy = saved === undefined ? legacyContent() : null
      const revision =
        saved === undefined
          ? legacy === null
            ? null
            : 'legacy:' + legacy
          : record(saved) && typeof saved.revision === 'string'
            ? saved.revision
            : 'unreadable'
      if (revision !== expected) return
      next = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('')
      const background = doc.appearance.background
      const draft: DraftRecord = {
        revision: next,
        doc: {
          ...doc,
          appearance: {
            ...doc.appearance,
            background: { ...background, media: null },
          },
        },
      }
      store.put(draft, 'draft')
      if (!background.media) store.delete('background')
      else if (background.media !== priorMedia || saved === undefined)
        store.put(background.media, 'background')
    }
    await done
    if (next === null) return { status: 'conflict' } as const
    return { status: 'saved', revision: next } as const
  } catch {
    return { status: 'unavailable' } as const
  }
}
