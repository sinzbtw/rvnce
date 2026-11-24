import { useEffect, useRef, useState } from 'preact/hooks'
import type { ProfileDocument } from '../profile/document'
import {
  draftChannel,
  draftKey,
  readDraft,
  saveDraft,
  type StoredDraft,
} from './storage'

type DraftStatus = StoredDraft['status'] | 'pending' | 'conflict'

export function useDraft(initial: StoredDraft, sample: ProfileDocument) {
  const [doc, setDoc] = useState(initial.doc ?? sample)
  const [status, setStatus] = useState<DraftStatus>(initial.status)
  const [otherDraft, setOtherDraft] = useState<StoredDraft | null>(
    initial.status === 'invalid' ? initial : null,
  )
  const latest = useRef(doc)
  const revision = useRef(initial.revision)
  const background = useRef(doc.appearance.background.media)
  const blocked = useRef(otherDraft !== null)
  const dirty = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const saving = useRef(false)
  const channel = useRef<BroadcastChannel | null>(null)

  function updateDocument(next: ProfileDocument) {
    latest.current = next
    setDoc(next)
  }

  function showOtherDraft(stored: StoredDraft) {
    blocked.current = true
    setOtherDraft(stored)
    setStatus('conflict')
  }

  async function flush() {
    window.clearTimeout(timer.current)
    timer.current = undefined
    if (!dirty.current || blocked.current || saving.current) return

    saving.current = true
    const snapshot = latest.current
    try {
      const result = await saveDraft(
        snapshot,
        revision.current,
        background.current,
      )
      if (result.status === 'saved') {
        revision.current = result.revision
        background.current = snapshot.appearance.background.media
        dirty.current = latest.current !== snapshot
        channel.current?.postMessage(result.revision)
        if (dirty.current) queueSave()
        else if (!blocked.current) setStatus('saved')
      } else if (result.status === 'conflict') {
        showOtherDraft(await readDraft())
      } else {
        setStatus('unavailable')
      }
    } finally {
      saving.current = false
    }
  }

  function queueSave() {
    dirty.current = true
    if (blocked.current) return
    setStatus('pending')
    if (timer.current === undefined)
      timer.current = window.setTimeout(() => void flush(), 250)
  }

  function update(edit: (current: ProfileDocument) => ProfileDocument) {
    const next = edit(latest.current)
    if (next === latest.current) return
    updateDocument(next)
    queueSave()
  }

  async function loadStoredDraft(): Promise<boolean> {
    const stored = await readDraft()
    if (stored.status === 'unavailable') return false
    if (stored.status === 'invalid') {
      showOtherDraft(stored)
      return false
    }
    revision.current = stored.revision
    blocked.current = false
    dirty.current = false
    const next = stored.doc ?? sample
    background.current = next.appearance.background.media
    setOtherDraft(null)
    updateDocument(next)
    setStatus(stored.status)
    return true
  }

  function replaceUnreadableDraft() {
    if (otherDraft?.status !== 'invalid') return
    revision.current = otherDraft.revision
    blocked.current = false
    setOtherDraft(null)
    dirty.current = true
    setStatus('pending')
    void flush()
  }

  useEffect(() => {
    async function checkRevision() {
      const observed = revision.current
      const stored = await readDraft()
      if (
        revision.current === observed &&
        !saving.current &&
        stored.status !== 'unavailable' &&
        stored.revision !== observed
      ) {
        showOtherDraft(stored)
      }
    }

    function onStorage(event: StorageEvent) {
      if (event.key === draftKey || event.key === null) void checkRevision()
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') void flush()
      else void checkRevision()
    }

    try {
      channel.current = new BroadcastChannel(draftChannel)
      channel.current.onmessage = () => void checkRevision()
    } catch {
      // Storage revisions are also checked on focus and in each write transaction.
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', checkRevision)
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearTimeout(timer.current)
      channel.current?.close()
      channel.current = null
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', checkRevision)
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  return {
    doc,
    latest,
    status,
    otherDraft,
    update,
    loadStoredDraft,
    replaceUnreadableDraft,
  }
}
