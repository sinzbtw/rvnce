import { useEffect, useRef, useState } from 'preact/hooks'
import {
  defaultAccent,
  editableText,
  limits,
  parseProfile,
  profileIssues,
  profileLanguage,
  type LinkBlock,
  type ProfileDocument,
} from '../profile/document'
import { accentInk } from '../public/colors'
import { PublicProfile } from '../public/PublicProfile'
import { Icon } from './Icon'
import {
  download,
  encodeAvatar,
  importProfile,
  normalizeAvatar,
  pngDataUrl,
} from './files'
import type { StoredDraft } from './storage'
import { useDraft } from './useDraft'

const sections = ['Profile', 'Links', 'Appearance'] as const
type Section = (typeof sections)[number]

const saveMessages = {
  ready: 'Edits save here',
  pending: 'Saving…',
  saved: 'Saved locally',
  unavailable:
    'Browser storage is unavailable. Changes may be lost if you refresh or close this page. Export JSON to keep a copy.',
  invalid:
    'The saved draft could not be loaded. Download the original or replace it with this profile.',
  recovered:
    'The saved draft was recovered. Unsupported control characters were removed or replaced.',
  conflict:
    'The saved draft changed in another tab. Export JSON to keep your edits here before loading the saved version.',
  'invalid-edit': 'This draft could not be saved. Check the edited fields.',
}

const colors = [
  ['Indigo', defaultAccent],
  ['Raspberry', '#aa2161'],
  ['Forest', '#176451'],
  ['Blue', '#2350b4'],
  ['Ochre', '#efaa3c'],
  ['Graphite', '#252735'],
] as const

function message(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Try again.'
}

function fieldValue(
  input: HTMLInputElement | HTMLTextAreaElement,
  multiline = false,
): string {
  const value = editableText(input.value, multiline)
  if (value !== input.value) {
    const start = input.selectionStart
    const end = input.selectionEnd
    const previous = input.value
    input.value = value
    if (start !== null && end !== null) {
      input.setSelectionRange(
        editableText(previous.slice(0, start), multiline).length,
        editableText(previous.slice(0, end), multiline).length,
      )
    }
  }
  return value
}

export function Editor({
  initialDraft,
  sample,
  sampleAvatarUrl,
}: {
  initialDraft: StoredDraft
  sample: ProfileDocument
  sampleAvatarUrl: string
}) {
  const draft = useDraft(initialDraft, sample)
  const { doc, latest, status, otherDraft } = draft
  const [section, setSection] = useState<Section>('Profile')
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit')
  const [device, setDevice] = useState<'wide' | 'phone'>('wide')
  const [notice, setNotice] = useState('')
  const [avatarError, setAvatarError] = useState('')
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [pendingImport, setPendingImport] = useState<ProfileDocument | null>(
    null,
  )
  const importInput = useRef<HTMLInputElement>(null)
  const avatarInput = useRef<HTMLInputElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const addFocus = useRef<string | null>(null)
  const avatarOperation = useRef(0)
  const importOperation = useRef(0)

  const issues = profileIssues(doc)
  const avatar = doc.profile.avatar ? pngDataUrl(doc.profile.avatar) : null
  const previewDoc = {
    ...doc,
    blocks: doc.blocks.filter((_, index) => {
      const issue = issues.blocks[index]
      return issue && !issue.label && !issue.url
    }),
  }
  const palette = {
    '--accent': doc.appearance.accent,
    '--accent-ink': accentInk(doc.appearance.accent),
  }
  const quietStatus =
    status === 'ready' || status === 'pending' || status === 'saved'

  useEffect(() => {
    if (initialDraft.doc) return
    const controller = new AbortController()
    void fetch(sampleAvatarUrl, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return
        const encoded = await encodeAvatar(await response.blob())
        if (!controller.signal.aborted && avatarOperation.current === 0) {
          draft.useSampleAvatar(encoded)
        }
      })
      .catch(() => {
        // The sample can be edited and published with initials.
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (pendingImport && !dialog.current?.open) dialog.current?.showModal()
  }, [pendingImport])

  useEffect(() => {
    if (addFocus.current) {
      document.getElementById(addFocus.current)?.focus()
      addFocus.current = null
    }
  }, [doc.blocks.length, section])

  function update(edit: (current: ProfileDocument) => ProfileDocument) {
    draft.update(edit)
    setNotice('')
  }

  async function uploadAvatar(file: File) {
    const operation = ++avatarOperation.current
    setAvatarError('')
    setAvatarLoading(true)
    try {
      const avatar = await normalizeAvatar(file)
      if (operation === avatarOperation.current) {
        update((current) => ({
          ...current,
          profile: { ...current.profile, avatar },
        }))
      }
    } catch (error) {
      if (operation === avatarOperation.current) setAvatarError(message(error))
    } finally {
      if (operation === avatarOperation.current) setAvatarLoading(false)
    }
  }

  function clearAvatarOperation() {
    avatarOperation.current++
    setAvatarLoading(false)
    setAvatarError('')
  }

  function removeAvatar() {
    clearAvatarOperation()
    update((current) => ({
      ...current,
      profile: { ...current.profile, avatar: null },
    }))
  }

  function addLink() {
    if (latest.current.blocks.length >= limits.blocks) return
    const id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')
    addFocus.current = 'label-' + id
    update((current) => ({
      ...current,
      blocks: [...current.blocks, { id, type: 'link', label: '', url: '' }],
    }))
  }

  function editLink(id: string, field: 'label' | 'url', value: string) {
    update((current) => ({
      ...current,
      blocks: current.blocks.map((block) =>
        block.id === id ? { ...block, [field]: value } : block,
      ),
    }))
  }

  function moveLink(id: string, offset: number) {
    update((current) => {
      const index = current.blocks.findIndex((block) => block.id === id)
      const target = index + offset
      const blocks = [...current.blocks]
      const from = blocks[index]
      const to = blocks[target]
      if (!from || !to) return current
      blocks[index] = to
      blocks[target] = from
      const direction =
        target + offset < 0 || target + offset >= blocks.length
          ? -offset
          : offset
      const focusId = (direction < 0 ? 'move-up-' : 'move-down-') + id
      requestAnimationFrame(() => document.getElementById(focusId)?.focus())
      return { ...current, blocks }
    })
  }

  function removeLink(id: string) {
    const index = latest.current.blocks.findIndex((block) => block.id === id)
    const next =
      latest.current.blocks[index + 1] ?? latest.current.blocks[index - 1]
    addFocus.current = next ? 'label-' + next.id : 'add-link'
    update((current) => ({
      ...current,
      blocks: current.blocks.filter((block) => block.id !== id),
    }))
  }

  async function readImport(file: File) {
    const operation = ++importOperation.current
    try {
      const imported = await importProfile(file)
      if (operation !== importOperation.current) return
      setNotice('')
      setPendingImport(imported)
    } catch (error) {
      if (operation === importOperation.current) setNotice(message(error))
    }
  }

  function showProfile() {
    clearAvatarOperation()
    setSection('Profile')
    setMobileTab('edit')
  }

  function acceptImport(imported: ProfileDocument) {
    dialog.current?.close()
    update(() => imported)
    showProfile()
    setPendingImport(null)
    setNotice('Profile imported.')
  }

  async function exportProfile(format: 'json' | 'zip') {
    if (format === 'zip' && exporting) return
    const snapshot = latest.current
    if (format === 'zip') {
      const problems = profileIssues(snapshot)
      const index = problems.blocks.findIndex(
        (block) => block.label || block.url,
      )
      const profileField = problems.name
        ? 'profile-name'
        : problems.language
          ? 'profile-language'
          : ''
      if (profileField || index >= 0) {
        const id =
          profileField ||
          (problems.blocks[index]?.label ? 'label-' : 'url-') +
            snapshot.blocks[index]?.id
        setSection(profileField ? 'Profile' : 'Links')
        setMobileTab('edit')
        setNotice('Complete the highlighted fields before downloading.')
        requestAnimationFrame(() => document.getElementById(id)?.focus())
        return
      }
    }
    try {
      const clean = parseProfile(
        JSON.stringify(snapshot),
        format === 'zip' ? 'publish' : 'draft',
      )
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(clean, null, 2) + '\n'], {
          type: 'application/json',
        })
        download(blob, 'rvnce-profile.json')
        setNotice('Profile JSON downloaded.')
      } else {
        setExporting(true)
        const { zipProfile } = await import('./site-download')
        download(await zipProfile(clean), 'rvnce-site.zip')
        setNotice('Site ZIP downloaded.')
      }
    } catch (error) {
      setNotice(message(error))
    } finally {
      if (format === 'zip') setExporting(false)
    }
  }

  function linkLabel(block: LinkBlock, index: number) {
    return block.label.trim() || 'Link ' + (index + 1)
  }

  return (
    <>
      <header class="app-header">
        <div class="brand" aria-label="Rvnce">
          <span class="brand-mark" aria-hidden="true">
            R
          </span>
          <span>Rvnce</span>
        </div>
        <div class="header-actions">
          <input
            ref={importInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              event.currentTarget.value = ''
              if (file) void readImport(file)
            }}
          />
          <button
            class="button button-quiet"
            onClick={() => importInput.current?.click()}
          >
            <Icon name="upload" /> Import JSON
          </button>
          <button
            class="button button-quiet"
            onClick={() => void exportProfile('json')}
          >
            <Icon name="file" /> Export JSON
          </button>
          <button
            class="button button-primary"
            disabled={exporting}
            onClick={() => void exportProfile('zip')}
          >
            <Icon name="download" />{' '}
            {exporting ? 'Preparing…' : 'Download site'}
          </button>
        </div>
      </header>
      {(!quietStatus || notice) && (
        <div class="notice-strip">
          <div class="notice-messages" role="status">
            {!quietStatus && <p>{saveMessages[status]}</p>}
            {notice && <p>{notice}</p>}
          </div>
          {otherDraft && (
            <div class="draft-actions">
              {otherDraft.status === 'invalid' ? (
                <>
                  <button
                    class="button button-outline"
                    onClick={() => {
                      if (otherDraft.content !== null) {
                        download(
                          new Blob([otherDraft.content], {
                            type: 'application/json',
                          }),
                          'rvnce-original-draft.json',
                        )
                      }
                    }}
                  >
                    Download original
                  </button>
                  <button
                    class="button button-outline"
                    onClick={draft.replaceUnreadableDraft}
                  >
                    Replace saved draft
                  </button>
                </>
              ) : (
                <>
                  <button
                    class="button button-outline"
                    onClick={() => void exportProfile('json')}
                  >
                    Download my copy
                  </button>
                  <button
                    class="button button-outline"
                    onClick={() => {
                      if (draft.loadStoredDraft()) {
                        showProfile()
                        setNotice('Saved draft loaded.')
                      }
                    }}
                  >
                    Load saved draft
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
      <nav class="mobile-nav" aria-label="Workspace">
        <button
          aria-pressed={mobileTab === 'edit'}
          onClick={() => setMobileTab('edit')}
        >
          Editor
        </button>
        <button
          aria-pressed={mobileTab === 'preview'}
          onClick={() => setMobileTab('preview')}
        >
          Preview
        </button>
      </nav>
      <main class="workspace" data-mobile-tab={mobileTab}>
        <section class="settings" aria-labelledby="editor-title">
          <div class="editor-heading">
            <h1 id="editor-title">Edit profile</h1>
            {quietStatus && (
              <span class="save-status" role="status">
                <span aria-hidden="true" />
                {saveMessages[status]}
              </span>
            )}
          </div>
          <nav class="section-nav" aria-label="Profile settings">
            {sections.map((item) => (
              <button
                key={item}
                aria-pressed={section === item}
                onClick={() => setSection(item)}
              >
                {item}
              </button>
            ))}
          </nav>
          {section === 'Profile' && (
            <div class="form-panel">
              <div class="avatar-field">
                <div class="avatar-small">
                  {avatar ? (
                    <img src={avatar} alt="" />
                  ) : (
                    <span aria-hidden="true">R</span>
                  )}
                </div>
                <div class="avatar-controls">
                  <span class="field-label">Profile photo</span>
                  <p>PNG, JPG or WebP · up to 4 MiB and 24 MP</p>
                  <div class="avatar-actions">
                    <input
                      ref={avatarInput}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      hidden
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0]
                        event.currentTarget.value = ''
                        if (file) void uploadAvatar(file)
                      }}
                    />
                    <button
                      class="button button-outline"
                      disabled={avatarLoading}
                      onClick={() => avatarInput.current?.click()}
                    >
                      {avatarLoading
                        ? 'Processing…'
                        : avatar
                          ? 'Change photo'
                          : 'Upload photo'}
                    </button>
                    {avatar && (
                      <button
                        class="button button-quiet"
                        onClick={removeAvatar}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {avatarError && (
                <p class="field-error" role="alert">
                  {avatarError}
                </p>
              )}
              <label class="field" for="profile-name">
                <span class="field-label">Display name</span>
                <input
                  id="profile-name"
                  value={doc.profile.name}
                  maxLength={limits.name}
                  aria-invalid={Boolean(issues.name)}
                  aria-describedby={issues.name ? 'name-error' : undefined}
                  onInput={(event) => {
                    const name = fieldValue(event.currentTarget)
                    update((current) => ({
                      ...current,
                      profile: { ...current.profile, name },
                    }))
                  }}
                />
                {issues.name && (
                  <span class="field-error" id="name-error">
                    {issues.name}
                  </span>
                )}
              </label>
              <div class="field">
                <label class="field-label" for="profile-bio">
                  Bio
                </label>
                <textarea
                  id="profile-bio"
                  rows={4}
                  value={doc.profile.bio}
                  maxLength={limits.bio}
                  aria-describedby="bio-limit"
                  onInput={(event) => {
                    const bio = fieldValue(event.currentTarget, true)
                    update((current) => ({
                      ...current,
                      profile: { ...current.profile, bio },
                    }))
                  }}
                />
                <span class="character-count" id="bio-limit">
                  {doc.profile.bio.length} / {limits.bio}
                </span>
              </div>
              <div class="field">
                <label class="field-label" for="profile-language">
                  Page language
                </label>
                <input
                  id="profile-language"
                  value={doc.profile.language}
                  maxLength={limits.language}
                  autoCapitalize="off"
                  spellcheck={false}
                  aria-invalid={Boolean(issues.language)}
                  aria-describedby={
                    issues.language ? 'language-error' : 'language-help'
                  }
                  onInput={(event) => {
                    const language = fieldValue(event.currentTarget)
                    update((current) => ({
                      ...current,
                      profile: { ...current.profile, language },
                    }))
                  }}
                  onBlur={(event) => {
                    const entered = event.currentTarget.value
                    const language = profileLanguage(entered)
                    if (language && language !== entered) {
                      update((current) => ({
                        ...current,
                        profile: { ...current.profile, language },
                      }))
                    }
                  }}
                />
                {issues.language ? (
                  <span class="field-error" id="language-error">
                    {issues.language}
                  </span>
                ) : (
                  <span class="field-help" id="language-help">
                    Use a language tag such as en, ru, or pt-BR.
                  </span>
                )}
              </div>
            </div>
          )}
          {section === 'Links' && (
            <div class="form-panel">
              {doc.blocks.length === 0 && (
                <p class="empty-message">
                  Add a link to a site you want visitors to find.
                </p>
              )}
              {doc.blocks.map((block, index) => {
                const issue = issues.blocks[index]
                const label = linkLabel(block, index)
                return (
                  <fieldset class="link-fieldset" key={block.id}>
                    <legend>{'Link ' + (index + 1)}</legend>
                    <div class="link-tools">
                      <button
                        class="icon-button"
                        id={'move-up-' + block.id}
                        disabled={index === 0}
                        aria-label={'Move ' + label + ' up'}
                        onClick={() => moveLink(block.id, -1)}
                      >
                        <Icon name="up" />
                      </button>
                      <button
                        class="icon-button"
                        id={'move-down-' + block.id}
                        disabled={index === doc.blocks.length - 1}
                        aria-label={'Move ' + label + ' down'}
                        onClick={() => moveLink(block.id, 1)}
                      >
                        <Icon name="down" />
                      </button>
                      <button
                        class="icon-button"
                        aria-label={'Remove ' + label}
                        onClick={() => removeLink(block.id)}
                      >
                        <Icon name="remove" />
                      </button>
                    </div>
                    <label class="field">
                      <span class="field-label">Label</span>
                      <input
                        id={'label-' + block.id}
                        value={block.label}
                        maxLength={limits.label}
                        aria-invalid={Boolean(issue?.label)}
                        aria-describedby={
                          issue?.label ? 'label-error-' + block.id : undefined
                        }
                        onInput={(event) =>
                          editLink(
                            block.id,
                            'label',
                            fieldValue(event.currentTarget),
                          )
                        }
                      />
                      {issue?.label && (
                        <span
                          class="field-error"
                          id={'label-error-' + block.id}
                        >
                          {issue.label}
                        </span>
                      )}
                    </label>
                    <label class="field">
                      <span class="field-label">URL</span>
                      <input
                        id={'url-' + block.id}
                        type="url"
                        value={block.url}
                        maxLength={limits.url}
                        placeholder="https://example.com"
                        aria-invalid={Boolean(issue?.url)}
                        aria-describedby={
                          issue?.url ? 'url-error-' + block.id : undefined
                        }
                        onInput={(event) =>
                          editLink(
                            block.id,
                            'url',
                            fieldValue(event.currentTarget),
                          )
                        }
                      />
                      {issue?.url && (
                        <span class="field-error" id={'url-error-' + block.id}>
                          {issue.url}
                        </span>
                      )}
                    </label>
                  </fieldset>
                )
              })}
              <button
                id="add-link"
                class="button button-outline add-link"
                disabled={doc.blocks.length >= limits.blocks}
                onClick={addLink}
              >
                <Icon name="plus" /> Add link
              </button>
              {doc.blocks.length >= limits.blocks && (
                <p class="empty-message">
                  This profile has the maximum of {limits.blocks} links.
                </p>
              )}
            </div>
          )}
          {section === 'Appearance' && (
            <div class="form-panel">
              <fieldset class="appearance-fieldset">
                <legend>Theme</legend>
                <div class="theme-options">
                  {(['light', 'dark'] as const).map((variant) => (
                    <label key={variant} class="theme-option">
                      <input
                        type="radio"
                        name="variant"
                        value={variant}
                        checked={doc.appearance.variant === variant}
                        onChange={() =>
                          update((current) => ({
                            ...current,
                            appearance: { ...current.appearance, variant },
                          }))
                        }
                      />
                      <Icon name={variant === 'light' ? 'sun' : 'moon'} />
                      {variant === 'light' ? 'Light' : 'Dark'}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset class="appearance-fieldset">
                <legend>Accent color</legend>
                <div class="swatches">
                  {colors.map(([name, accent]) => (
                    <button
                      key={accent}
                      type="button"
                      class="swatch"
                      style={{ '--swatch': accent }}
                      title={name}
                      aria-label={name}
                      aria-pressed={doc.appearance.accent === accent}
                      onClick={() =>
                        update((current) => ({
                          ...current,
                          appearance: { ...current.appearance, accent },
                        }))
                      }
                    >
                      <span />
                    </button>
                  ))}
                </div>
                <label class="custom-color">
                  <input
                    type="color"
                    value={doc.appearance.accent}
                    onInput={(event) => {
                      const accent = event.currentTarget.value
                      update((current) => ({
                        ...current,
                        appearance: { ...current.appearance, accent },
                      }))
                    }}
                  />{' '}
                  Custom color{' '}
                  <span>{doc.appearance.accent.toUpperCase()}</span>
                </label>
              </fieldset>
            </div>
          )}
        </section>
        <section class="preview-pane" aria-labelledby="preview-title">
          <div class="preview-toolbar">
            <h2 id="preview-title">Live preview</h2>
            <div class="preview-tools">
              <div
                class="device-controls"
                role="group"
                aria-label="Preview width"
              >
                <button
                  class="icon-button"
                  title="Wide preview"
                  aria-label="Wide preview"
                  aria-pressed={device === 'wide'}
                  onClick={() => setDevice('wide')}
                >
                  <Icon name="monitor" />
                </button>
                <button
                  class="icon-button"
                  title="Phone preview"
                  aria-label="Phone preview"
                  aria-pressed={device === 'phone'}
                  onClick={() => setDevice('phone')}
                >
                  <Icon name="phone" />
                </button>
              </div>
              <a
                class="demo-link"
                href="./demo/index.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                View demo <Icon name="external" />
              </a>
            </div>
          </div>
          <div
            class="preview-frame profile-viewport"
            data-device={device}
            style={palette}
          >
            <PublicProfile doc={previewDoc} avatarUrl={avatar} preview />
          </div>
        </section>
      </main>
      <dialog
        ref={dialog}
        class="import-dialog"
        aria-labelledby="import-title"
        onClose={() => setPendingImport(null)}
      >
        {pendingImport && (
          <>
            <h2 id="import-title">Replace current profile?</h2>
            <p>
              This will replace your draft with{' '}
              <strong>
                {pendingImport.profile.name.trim() || 'an unnamed profile'}
              </strong>
              . Export the current draft first if you need a copy.
            </p>
            <div class="dialog-actions">
              <button
                class="button button-outline"
                autoFocus
                onClick={() => dialog.current?.close()}
              >
                Cancel
              </button>
              <button
                class="button button-primary"
                onClick={() => acceptImport(pendingImport)}
              >
                Replace profile
              </button>
            </div>
          </>
        )}
      </dialog>
    </>
  )
}
