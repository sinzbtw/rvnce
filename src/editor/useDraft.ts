import { useEffect, useRef, useState } from 'preact/hooks'
import type { ProfileDocument } from '../profile/document'
import { draftKey, readDraft, saveDraft, type StoredDraft } from './storage'

type DraftStatus =
  StoredDraft['status'] | 'pending' | 'conflict' | 'invalid-edit'

export function useDraft(initial: StoredDraft, sample: ProfileDocument) {
  const [doc, setDoc] = useState(initial.doc ?? sample)
  const [status, setStatus] = useState<DraftStatus>(initial.status)
  const [otherDraft, setOtherDraft] = useState<StoredDraft | null>(
    initial.status === 'invalid' ? initial : null,
  )
  const latest = useRef(doc)
  const revision = useRef(initial.content)
  const blocked = useRef(otherDraft !== null)
  const dirty = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const saving = useRef(false)

  function updateDocument(next: ProfileDocument) {
    latest.current = next
    setDoc(next)
  }

  function showOtherDraft(stored: StoredDraft) {
    blocked.current = true
    setOtherDraft(stored)
    setStatus('conflict')
  }

  function flush() {
    window.clearTimeout(timer.current)
    timer.current = undefined
    if (!dirty.current || blocked.current) return
    const result = saveDraft(latest.current, revision.current)
    if (result.status === 'saved') {
      revision.current = result.content
      dirty.current = false
    } else if (result.status === 'conflict') {
      showOtherDraft(readDraft())
      return
    }
    setStatus(result.status)
  }

  async function saveWithLock() {
    if (saving.current) return
    saving.current = true
    try {
      if (navigator.locks) await navigator.locks.request(draftKey, flush)
      else flush()
    } catch {
      flush()
    } finally {
      saving.current = false
    }
  }

  function queueSave() {
    dirty.current = true
    if (blocked.current) return
    setStatus('pending')
    if (timer.current === undefined) {
      // Keep the deadline fixed while typing so the latest edit is saved regularly.
      timer.current = window.setTimeout(() => {
        timer.current = undefined
        void saveWithLock()
      }, 250)
    }
  }

  function update(edit: (current: ProfileDocument) => ProfileDocument) {
    const next = edit(latest.current)
    if (next === latest.current) return
    updateDocument(next)
    queueSave()
  }

  function useSampleAvatar(avatar: string) {
    if (latest.current !== sample) return
    updateDocument({ ...sample, profile: { ...sample.profile, avatar } })
  }

  function loadStoredDraft(): boolean {
    const stored = readDraft()
    if (stored.status === 'unavailable') return false
    if (stored.status === 'invalid') {
      showOtherDraft(stored)
      return false
    }
    revision.current = stored.content
    blocked.current = false
    dirty.current = false
    setOtherDraft(null)
    updateDocument(stored.doc ?? sample)
    setStatus(stored.status)
    return true
  }

  function replaceUnreadableDraft() {
    if (otherDraft?.status !== 'invalid') return
    revision.current = otherDraft.content
    blocked.current = false
    setOtherDraft(null)
    dirty.current = true
    setStatus('pending')
    void saveWithLock()
  }

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (
        event.storageArea !== localStorage ||
        (event.key !== draftKey && event.key !== null)
      )
        return
      const stored = readDraft()
      if (
        stored.status !== 'unavailable' &&
        stored.content !== revision.current
      ) {
        showOtherDraft(stored)
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') void saveWithLock()
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearTimeout(timer.current)
      window.removeEventListener('storage', onStorage)
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
    useSampleAvatar,
    loadStoredDraft,
    replaceUnreadableDraft,
  }
}
