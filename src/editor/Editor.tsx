import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import brandMark from '../assets/rvnce-mark.png?url&no-inline'
import type { Appearance } from '../profile/appearance'
import {
  editableText,
  limits,
  profileIssues,
  profileLanguage,
  validateProfile,
  type LinkBlock,
  type ProfileDocument,
} from '../profile/document'
import { examples } from '../profile/demo'
import { tabTitleMotions, type TabTitleMotion } from '../profile/effects'
import { bytesOf } from '../profile/media'
import { AppearanceEditor } from './Appearance'
import { IconLinkFields } from './IconLinkFields'
import { ProfilePreview } from './ProfilePreview'
import { PreviewTab } from './PreviewTab'
import { useFloatingPreview } from './floating-preview'
import { Icon } from './Icon'
import {
  download,
  importProfile,
  normalizeAvatar,
  normalizeFavicon,
  pngDataUrl,
} from './files'
import { locales, type Locale, type Message } from './messages'
import { useLinkMotion, usePanelMotion } from './motion'
import {
  applyLocale,
  transitionTheme,
  CopyContext,
  copyFor,
  errorCopy,
  languageNames,
  savePreference,
  themes,
  type EditorTheme,
} from './preferences'
import type { StoredDraft } from './storage'
import { useDraft } from './useDraft'

const sections = ['Profile', 'Links', 'Appearance'] as const
type Section = (typeof sections)[number]
const sectionIcons = {
  Profile: 'person',
  Links: 'link',
  Appearance: 'palette',
} as const

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
} as const

const themeLabels = { system: 'System', light: 'Light', dark: 'Dark' } as const
const themeIcons = { system: 'monitor', light: 'sun', dark: 'moon' } as const
const phoneLayout = '(max-width: 859px)'

function useImageFile(
  normalize: (file: File) => Promise<string>,
  change: (encoded: string) => void,
) {
  const operation = useRef(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<{ cause: unknown } | null>(null)

  function clear() {
    operation.current++
    setLoading(false)
    setError(null)
  }

  async function upload(file: File) {
    const id = ++operation.current
    setError(null)
    setLoading(true)
    try {
      const encoded = await normalize(file)
      if (id === operation.current) change(encoded)
    } catch (cause) {
      if (id === operation.current) setError({ cause })
    } finally {
      if (id === operation.current) setLoading(false)
    }
  }

  return { loading, error, clear, upload }
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
  initialLocale,
  initialTheme,
}: {
  initialDraft: StoredDraft
  sample: ProfileDocument
  initialLocale: Locale
  initialTheme: EditorTheme
}) {
  const draft = useDraft(initialDraft, sample)
  const { doc, latest, status, otherDraft } = draft
  const [priorAppearance, setPriorAppearance] = useState<Appearance | null>(
    null,
  )
  const [publishAttempted, setPublishAttempted] = useState(false)
  const [section, setSection] = useState<Section>('Profile')
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit')
  const [device, setDevice] = useState<'wide' | 'phone'>('wide')
  const [locale, setLocale] = useState(initialLocale)
  const [theme, setTheme] = useState(initialTheme)
  const [desktopPreview, setDesktopPreview] = useState(false)
  const [mobile, setMobile] = useState(() => matchMedia(phoneLayout).matches)
  const [notice, setNotice] = useState<Message | { cause: unknown } | null>(
    null,
  )
  const [exporting, setExporting] = useState(false)
  const [pendingImport, setPendingImport] = useState<ProfileDocument | null>(
    null,
  )
  const [importName, setImportName] = useState('')
  const importInput = useRef<HTMLInputElement>(null)
  const avatarInput = useRef<HTMLInputElement>(null)
  const faviconInput = useRef<HTMLInputElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const preferencesMenu = useRef<HTMLDetailsElement>(null)
  const addFocus = useRef<string | null>(null)
  const importOperation = useRef(0)
  const mobileScroll = useRef(0)
  const returningToEditor = useRef(false)
  const settingsPanel = useRef<HTMLDivElement>(null)
  const settings = useRef<HTMLElement>(null)
  const previewPane = useRef<HTMLElement>(null)
  const previewToggle = useRef<HTMLButtonElement>(null)
  const focusPreview = useRef(false)
  const previewGrip = useRef<HTMLButtonElement>(null)
  const previewFrame = useRef<HTMLDivElement>(null)
  const examplesMenu = useRef<HTMLDetailsElement>(null)
  const t = copyFor(locale)

  const avatarFile = useImageFile(normalizeAvatar, (encoded) =>
    update((current) => ({
      ...current,
      profile: { ...current.profile, avatar: encoded },
    })),
  )
  const faviconFile = useImageFile(normalizeFavicon, (encoded) =>
    update((current) => ({
      ...current,
      branding: { ...current.branding, favicon: encoded },
    })),
  )
  const previewShown = mobile ? mobileTab === 'preview' : desktopPreview
  const previewMobileDevice = mobile ? 'phone' : device
  const previewGesture = useFloatingPreview(
    previewPane,
    desktopPreview,
    !mobile,
  )
  const captureLinks = useLinkMotion(settingsPanel, doc.blocks)
  usePanelMotion(
    settingsPanel,
    mobile && mobileTab === 'preview' ? null : section,
    0.16,
  )
  usePanelMotion(
    previewFrame,
    mobile ? (previewShown ? 'phone' : null) : device,
    0.22,
  )

  const issues = profileIssues(doc)
  const avatar = doc.profile.avatar ? pngDataUrl(doc.profile.avatar) : null
  const favicon = doc.branding.favicon ? pngDataUrl(doc.branding.favicon) : null
  const tabTitle = doc.branding.tabTitle
  const tabText = doc.profile.name.trim() || t('Your name')
  function changeTabTitle(change: Partial<TabTitleMotion>) {
    update((current) => ({
      ...current,
      branding: {
        ...current.branding,
        tabTitle: { ...current.branding.tabTitle, ...change },
      },
    }))
  }
  const media = doc.appearance.background.media
  const exportBytes = media
    ? bytesOf(media.data) + ('poster' in media ? bytesOf(media.poster) : 0)
    : 0
  const showNameError = publishAttempted && Boolean(issues.name)
  const previewDoc = {
    ...doc,
    blocks: doc.blocks.filter((_, index) => {
      const issue = issues.blocks[index]
      return issue && !issue.label && !issue.url
    }),
  }
  const quietStatus =
    status === 'ready' || status === 'pending' || status === 'saved'

  useEffect(() => {
    const query = matchMedia(phoneLayout)
    const change = () => setMobile(query.matches)
    query.addEventListener('change', change)
    change()
    return () => query.removeEventListener('change', change)
  }, [])

  useLayoutEffect(() => {
    if (!mobile) return
    if (mobileTab === 'preview') {
      window.scrollTo(0, 0)
    } else if (returningToEditor.current) {
      returningToEditor.current = false
      window.scrollTo(0, mobileScroll.current)
    }
  }, [mobile, mobileTab])

  useLayoutEffect(() => {
    if (!desktopPreview || mobile || !focusPreview.current) return
    focusPreview.current = false
    previewGrip.current?.focus({ preventScroll: true })
  }, [desktopPreview, mobile])

  useEffect(() => {
    const lightDismiss = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      for (const menu of [preferencesMenu.current, examplesMenu.current]) {
        if (menu?.open && !menu.contains(target)) menu.open = false
      }
    }
    const escape = (event: KeyboardEvent) => {
      const menu = preferencesMenu.current
      if (event.key !== 'Escape' || event.defaultPrevented || !menu?.open)
        return
      menu.open = false
      menu.querySelector('summary')?.focus()
    }
    document.addEventListener('pointerdown', lightDismiss)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', lightDismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [])

  function switchMobile(tab: 'edit' | 'preview') {
    if (tab === mobileTab) return
    if (tab === 'preview') mobileScroll.current = window.scrollY
    returningToEditor.current = tab === 'edit'
    setMobileTab(tab)
  }

  function switchSection(next: Section) {
    if (next === section) return
    setSection(next)
    if (settings.current && settings.current.getBoundingClientRect().top < 0)
      settings.current.scrollIntoView({ block: 'start' })
  }

  function closeDesktopPreview() {
    setDesktopPreview(false)
    previewToggle.current?.focus({ preventScroll: true })
  }

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
    setNotice(null)
  }

  function updateAppearance(
    edit: (current: Appearance) => Appearance,
    remember = false,
  ) {
    const previous = latest.current.appearance
    if (remember) setPriorAppearance(previous)
    update((current) => ({ ...current, appearance: edit(current.appearance) }))
  }

  function undoAppearance() {
    if (!priorAppearance) return
    updateAppearance(() => priorAppearance)
    setPriorAppearance(null)
  }

  function removeAvatar() {
    avatarFile.clear()
    update((current) => ({
      ...current,
      profile: { ...current.profile, avatar: null },
    }))
  }

  function removeFavicon() {
    faviconFile.clear()
    update((current) => ({
      ...current,
      branding: { ...current.branding, favicon: null },
    }))
  }

  function addLink(type: LinkBlock['type']) {
    if (latest.current.blocks.length >= limits.blocks) return
    captureLinks()
    const id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')
    addFocus.current = 'label-' + id
    const fields = { id, label: '', url: '' }
    const link: LinkBlock =
      type === 'icon'
        ? { ...fields, type, icon: 'auto', image: null, tint: false }
        : { ...fields, type }
    update((current) => ({
      ...current,
      blocks: [...current.blocks, link],
    }))
  }

  function editLink(id: string, edit: (link: LinkBlock) => LinkBlock) {
    update((current) => ({
      ...current,
      blocks: current.blocks.map((block) =>
        block.id === id ? edit(block) : block,
      ),
    }))
  }

  function moveLink(id: string, offset: number) {
    update((current) => {
      const blocks = [...current.blocks]
      const index = blocks.findIndex((block) => block.id === id)
      const from = blocks[index]
      if (!from) return current
      const peers = blocks.flatMap((block, position) =>
        block.type === from.type ? [position] : [],
      )
      const destination = peers.indexOf(index) + offset
      const target = peers[destination]
      if (target === undefined) return current
      const to = blocks[target]
      if (!to) return current
      captureLinks()
      blocks[index] = to
      blocks[target] = from
      const direction =
        destination + offset < 0 || destination + offset >= peers.length
          ? -offset
          : offset
      const focusId = (direction < 0 ? 'move-up-' : 'move-down-') + id
      requestAnimationFrame(() => document.getElementById(focusId)?.focus())
      return { ...current, blocks }
    })
  }

  function removeLink(id: string) {
    const block = latest.current.blocks.find((item) => item.id === id)
    if (!block) return
    const peers = latest.current.blocks.filter(
      (item) => item.type === block.type,
    )
    const index = peers.indexOf(block)
    if (index < 0) return
    captureLinks(id)
    const next = peers[index + 1] ?? peers[index - 1]
    addFocus.current = next
      ? 'label-' + next.id
      : block.type === 'icon'
        ? 'add-icon-link'
        : 'add-link'
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
      setNotice(null)
      setImportName(imported.profile.name.trim())
      setPendingImport(imported)
    } catch (cause) {
      if (operation === importOperation.current) setNotice({ cause })
    }
  }

  function showProfile() {
    setPriorAppearance(null)
    setPublishAttempted(false)
    avatarFile.clear()
    faviconFile.clear()
    returningToEditor.current = false
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
      setPublishAttempted(true)
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
      const clean = validateProfile(
        snapshot,
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
    } catch (cause) {
      setNotice({ cause })
    } finally {
      if (format === 'zip') setExporting(false)
    }
  }

  function linkLabel(block: LinkBlock, index: number) {
    return block.label.trim() || t('Link {value}', { value: index + 1 })
  }

  return (
    <CopyContext.Provider value={t}>
      <header class="app-header">
        <div class="brand">
          <img src={brandMark} width="36" height="36" alt="" />
          <span>Rvnce</span>
        </div>
        <div class="header-tools">
          <details class="preferences-menu" ref={preferencesMenu}>
            <summary
              class="button button-quiet preferences-trigger"
              title={t('Editor settings')}
              aria-label={t('Editor settings')}
            >
              <Icon name="settings" />
              {t('Settings')}
            </summary>
            <div
              class="preferences-popover"
              role="group"
              aria-label={t('Editor settings')}
            >
              <label class="field preference-field">
                <Icon name="globe" />
                <span class="field-label">{t('Editor language')}</span>
                <select
                  id="editor-language"
                  value={locale}
                  onChange={(event) => {
                    const next = locales.find(
                      (value) => value === event.currentTarget.value,
                    )
                    if (!next) return
                    applyLocale(next)
                    savePreference('locale', next)
                    setLocale(next)
                  }}
                >
                  {locales.map((value) => (
                    <option key={value} value={value} lang={value}>
                      {languageNames[value]}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset class="theme-preference" id="editor-theme">
                <legend class="field-label">{t('Editor theme')}</legend>
                <div class="theme-segments">
                  {themes.map((value) => (
                    <button
                      key={value}
                      type="button"
                      class="button button-quiet"
                      aria-pressed={theme === value}
                      data-theme={value}
                      onClick={() => {
                        if (theme === value) return
                        transitionTheme(value)
                        savePreference('theme', value)
                        setTheme(value)
                      }}
                    >
                      <Icon name={themeIcons[value]} />
                      {t(themeLabels[value])}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          </details>
          <button
            type="button"
            class="button button-quiet preview-toggle"
            ref={previewToggle}
            aria-controls="preview-pane"
            aria-expanded={desktopPreview}
            aria-label={t(desktopPreview ? 'Hide preview' : 'Show preview')}
            title={t(desktopPreview ? 'Hide preview' : 'Show preview')}
            onClick={(event) => {
              if (desktopPreview) closeDesktopPreview()
              else {
                focusPreview.current = event.detail === 0
                setDesktopPreview(true)
              }
            }}
          >
            <Icon name="panel" />
            <span class="preview-toggle-label">{t('Preview')}</span>
          </button>
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
            title={t('Import JSON')}
            onClick={() => importInput.current?.click()}
          >
            <Icon name="upload" />{' '}
            <span class="action-label">{t('Import JSON')}</span>
          </button>
          <button
            class="button button-quiet"
            title={t('Export JSON')}
            onClick={() => void exportProfile('json')}
          >
            <Icon name="file" />{' '}
            <span class="action-label">{t('Export JSON')}</span>
          </button>
          <button
            class="button button-primary"
            disabled={exporting}
            aria-describedby={
              exportBytes >= 3 * 1024 ** 2 ? 'site-export-size' : undefined
            }
            onClick={() => void exportProfile('zip')}
          >
            <Icon name="download" />{' '}
            {t(exporting ? 'Preparing…' : 'Download site')}
            {exportBytes >= 3 * 1024 ** 2 && (
              <span
                id="site-export-size"
                class="export-size"
                aria-hidden="true"
              >
                {' '}
                · ≈ {(exportBytes / 1024 ** 2 + 0.4).toFixed(1)} MiB
              </span>
            )}
          </button>
        </div>
      </header>
      {(!quietStatus || notice) && (
        <div class="notice-strip">
          <div class="notice-messages" role="status">
            {!quietStatus && <p>{t(saveMessages[status])}</p>}
            {notice && (
              <p>
                {typeof notice === 'string'
                  ? t(notice)
                  : errorCopy(t, notice.cause)}
              </p>
            )}
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
                    {t('Download original')}
                  </button>
                  <button
                    class="button button-outline"
                    onClick={draft.replaceUnreadableDraft}
                  >
                    {t('Replace saved draft')}
                  </button>
                </>
              ) : (
                <>
                  <button
                    class="button button-outline"
                    onClick={() => void exportProfile('json')}
                  >
                    {t('Download my copy')}
                  </button>
                  <button
                    class="button button-outline"
                    onClick={async () => {
                      if (await draft.loadStoredDraft()) {
                        showProfile()
                        setNotice('Saved draft loaded.')
                      }
                    }}
                  >
                    {t('Load saved draft')}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
      <nav class="mobile-nav" aria-label={t('Workspace')}>
        <button
          aria-pressed={mobileTab === 'edit'}
          onClick={() => switchMobile('edit')}
        >
          {t('Editor')}
        </button>
        <button
          aria-pressed={mobileTab === 'preview'}
          onClick={() => switchMobile('preview')}
        >
          {t('Preview')}
        </button>
      </nav>
      <main
        class="workspace"
        data-mobile-tab={mobileTab}
        data-desktop-preview={desktopPreview ? 'shown' : 'hidden'}
      >
        <aside class="editor-sidebar">
          <nav class="section-nav" aria-label={t('Profile settings')}>
            {sections.map((item) => (
              <button
                key={item}
                aria-pressed={section === item}
                onClick={() => switchSection(item)}
              >
                <Icon name={sectionIcons[item]} />
                {t(item)}
              </button>
            ))}
          </nav>
        </aside>
        <section class="settings" aria-labelledby="editor-title" ref={settings}>
          <div class="editor-heading">
            <h1 id="editor-title">{t('Edit profile')}</h1>
            {quietStatus && (
              <span class="save-status" role="status">
                <span aria-hidden="true" />
                {t(saveMessages[status])}
              </span>
            )}
          </div>
          <div class="editor-panel" ref={settingsPanel}>
            {section === 'Profile' && (
              <div class="form-panel">
                <div class="avatar-field">
                  <div class="avatar-small">
                    {avatar ? (
                      <img src={avatar} alt="" />
                    ) : (
                      <Icon name="person" />
                    )}
                  </div>
                  <div class="avatar-controls">
                    <span class="field-label">{t('Profile photo')}</span>
                    <p>{t('PNG, JPG or WebP · up to 4 MiB and 24 MP')}</p>
                    <div class="avatar-actions">
                      <input
                        ref={avatarInput}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        hidden
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0]
                          event.currentTarget.value = ''
                          if (file) void avatarFile.upload(file)
                        }}
                      />
                      <button
                        class="button button-outline"
                        disabled={avatarFile.loading}
                        onClick={() => avatarInput.current?.click()}
                      >
                        {t(
                          avatarFile.loading
                            ? 'Processing…'
                            : avatar
                              ? 'Change photo'
                              : 'Upload photo',
                        )}
                      </button>
                      {avatar && (
                        <button
                          class="button button-quiet"
                          onClick={removeAvatar}
                        >
                          {t('Remove')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {avatarFile.error && (
                  <p class="field-error" role="alert">
                    {errorCopy(t, avatarFile.error.cause)}
                  </p>
                )}
                <label class="field" for="profile-name">
                  <span class="field-label">{t('Display name')}</span>
                  <input
                    id="profile-name"
                    value={doc.profile.name}
                    maxLength={limits.name}
                    aria-invalid={showNameError}
                    aria-describedby={showNameError ? 'name-error' : undefined}
                    onInput={(event) => {
                      const name = fieldValue(event.currentTarget)
                      update((current) => ({
                        ...current,
                        profile: { ...current.profile, name },
                      }))
                    }}
                  />
                  {showNameError && (
                    <span class="field-error" id="name-error">
                      {issues.name && t(issues.name)}
                    </span>
                  )}
                </label>
                <div class="field">
                  <label class="field-label" for="profile-bio">
                    {t('Bio')}
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
                    {t('Page language')}
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
                      {t(issues.language)}
                    </span>
                  ) : (
                    <span class="field-help" id="language-help">
                      {t('Use a language tag such as en, ru, or pt-BR.')}
                    </span>
                  )}
                </div>
                <div class="favicon-field">
                  <span class="favicon-thumbnail" aria-hidden="true">
                    {favicon ? (
                      <img src={favicon} alt="" />
                    ) : (
                      <Icon name="file" />
                    )}
                  </span>
                  <div class="avatar-controls">
                    <span class="field-label">{t('Browser tab icon')}</span>
                    <p>
                      {t('Shown in the browser tab of your published site.')}
                    </p>
                    <div class="avatar-actions">
                      <input
                        id="favicon-file"
                        ref={faviconInput}
                        type="file"
                        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                        aria-label={t('Browser tab icon')}
                        hidden
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0]
                          event.currentTarget.value = ''
                          if (file) void faviconFile.upload(file)
                        }}
                      />
                      <button
                        type="button"
                        class="button button-outline"
                        disabled={faviconFile.loading}
                        onClick={() => faviconInput.current?.click()}
                      >
                        {t(
                          faviconFile.loading
                            ? 'Processing…'
                            : favicon
                              ? 'Change icon'
                              : 'Upload icon',
                        )}
                      </button>
                      {favicon && (
                        <button
                          type="button"
                          class="button button-quiet"
                          onClick={removeFavicon}
                        >
                          {t('Remove icon')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {faviconFile.error && (
                  <p class="field-error" role="alert">
                    {errorCopy(t, faviconFile.error.cause)}
                  </p>
                )}
                <div class="tab-title-settings">
                  <label class="field">
                    <span class="field-label">{t('Tab title animation')}</span>
                    <select
                      aria-label={t('Tab title animation')}
                      value={tabTitle.preset}
                      onChange={(event) => {
                        const preset = tabTitleMotions.find(
                          (item) => item === event.currentTarget.value,
                        )
                        if (preset) changeTabTitle({ preset })
                      }}
                    >
                      <option value="none">{t('None')}</option>
                      <option value="typewriter">{t('Typewriter')}</option>
                      <option value="scroll">{t('Scrolling title')}</option>
                    </select>
                  </label>
                  {tabTitle.preset !== 'none' && (
                    <>
                      <label class="field">
                        <span class="field-label">
                          {t('Tab animation speed')}{' '}
                          <output aria-hidden="true">{tabTitle.speed}%</output>
                        </span>
                        <input
                          type="range"
                          aria-label={t('Tab animation speed')}
                          min={0}
                          max={100}
                          value={tabTitle.speed}
                          onInput={(event) =>
                            changeTabTitle({
                              speed: event.currentTarget.valueAsNumber,
                            })
                          }
                        />
                      </label>
                      <PreviewTab
                        title={tabText}
                        favicon={favicon}
                        motion={previewShown ? undefined : tabTitle}
                      />
                    </>
                  )}
                </div>
                <label class="appearance-check">
                  <input
                    type="checkbox"
                    checked={doc.branding.showMadeWithRvnce}
                    onChange={(event) => {
                      const showMadeWithRvnce = event.currentTarget.checked
                      update((profile) => ({
                        ...profile,
                        branding: { ...profile.branding, showMadeWithRvnce },
                      }))
                    }}
                  />
                  {t('Show Made with Rvnce')}
                </label>
              </div>
            )}
            {section === 'Links' && (
              <div class="form-panel">
                {doc.blocks.length === 0 && (
                  <p class="empty-message">
                    {t('Add a link to a site you want visitors to find.')}
                  </p>
                )}
                {(['link', 'icon'] as const).map((type) => {
                  const rows = doc.blocks.flatMap((block, index) =>
                    block.type === type
                      ? [{ block, issue: issues.blocks[index] }]
                      : [],
                  )
                  return (
                    <section
                      class="link-editor-group"
                      aria-labelledby={'link-group-' + type}
                      key={type}
                    >
                      <h3 id={'link-group-' + type}>
                        {t(type === 'icon' ? 'Icon links' : 'Button links')}
                      </h3>
                      {rows.map(({ block, issue }, index) => {
                        const label = linkLabel(block, index)
                        return (
                          <fieldset
                            class="link-fieldset"
                            key={block.id}
                            data-link-row={block.id}
                          >
                            <legend>
                              {t(
                                type === 'icon'
                                  ? 'Icon link {value}'
                                  : 'Link {value}',
                                { value: index + 1 },
                              )}
                            </legend>
                            <div class="link-tools">
                              <button
                                class="icon-button"
                                id={'move-up-' + block.id}
                                disabled={index === 0}
                                aria-label={t('Move {value} up', {
                                  value: label,
                                })}
                                onClick={() => moveLink(block.id, -1)}
                              >
                                <Icon name="up" />
                              </button>
                              <button
                                class="icon-button"
                                id={'move-down-' + block.id}
                                disabled={index === rows.length - 1}
                                aria-label={t('Move {value} down', {
                                  value: label,
                                })}
                                onClick={() => moveLink(block.id, 1)}
                              >
                                <Icon name="down" />
                              </button>
                              <button
                                class="icon-button"
                                aria-label={t('Remove {value}', {
                                  value: label,
                                })}
                                onClick={() => removeLink(block.id)}
                              >
                                <Icon name="remove" />
                              </button>
                            </div>
                            <label class="field">
                              <span class="field-label">{t('Label')}</span>
                              <input
                                id={'label-' + block.id}
                                value={block.label}
                                maxLength={limits.label}
                                aria-invalid={Boolean(issue?.label)}
                                aria-describedby={
                                  issue?.label
                                    ? 'label-error-' + block.id
                                    : undefined
                                }
                                onInput={(event) => {
                                  const label = fieldValue(event.currentTarget)
                                  editLink(block.id, (current) => ({
                                    ...current,
                                    label,
                                  }))
                                }}
                              />
                              {issue?.label && (
                                <span
                                  class="field-error"
                                  id={'label-error-' + block.id}
                                >
                                  {t(issue.label)}
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
                                  issue?.url
                                    ? 'url-error-' + block.id
                                    : undefined
                                }
                                onInput={(event) => {
                                  const url = fieldValue(event.currentTarget)
                                  editLink(block.id, (current) => ({
                                    ...current,
                                    url,
                                  }))
                                }}
                              />
                              {issue?.url && (
                                <span
                                  class="field-error"
                                  id={'url-error-' + block.id}
                                >
                                  {t(issue.url)}
                                </span>
                              )}
                            </label>
                            {block.type === 'icon' && (
                              <IconLinkFields
                                link={block}
                                update={(edit) =>
                                  editLink(block.id, (current) =>
                                    current.type === 'icon'
                                      ? edit(current)
                                      : current,
                                  )
                                }
                              />
                            )}
                          </fieldset>
                        )
                      })}
                      <button
                        id={type === 'icon' ? 'add-icon-link' : 'add-link'}
                        class="button button-outline add-link"
                        disabled={doc.blocks.length >= limits.blocks}
                        onClick={() => addLink(type)}
                      >
                        <Icon name="plus" />{' '}
                        {t(type === 'icon' ? 'Add icon link' : 'Add link')}
                      </button>
                    </section>
                  )
                })}
                {doc.blocks.length >= limits.blocks && (
                  <p class="empty-message">
                    {t('This profile has the maximum of {value} links.', {
                      value: limits.blocks,
                    })}
                  </p>
                )}
              </div>
            )}
            {section === 'Appearance' && (
              <AppearanceEditor
                appearance={doc.appearance}
                update={updateAppearance}
                replace={(edit) => updateAppearance(edit, true)}
                undo={undoAppearance}
                canUndo={priorAppearance !== null}
                renderPreview={(key) => (
                  <ProfilePreview key={key} doc={previewDoc} locale={locale} />
                )}
              />
            )}
          </div>
        </section>
        <section
          class="preview-pane"
          id="preview-pane"
          ref={previewPane}
          aria-labelledby="preview-title"
          inert={!previewShown}
          data-device={previewMobileDevice}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && !event.defaultPrevented && !mobile)
              closeDesktopPreview()
          }}
        >
          <div class="preview-window">
            <div class="preview-toolbar">
              <div class="preview-heading">
                <button
                  type="button"
                  ref={previewGrip}
                  class="icon-button preview-grip"
                  aria-label={t('Move preview')}
                  aria-describedby="preview-move-help"
                  title={t('Move preview')}
                  {...previewGesture}
                >
                  <Icon name="grip" />
                </button>
                <span class="visually-hidden" id="preview-move-help">
                  {t(
                    'Drag or use the arrow keys to move. Press Home to reset the position.',
                  )}
                </span>
                <h2 id="preview-title">{t('Live preview')}</h2>
              </div>
              <div class="preview-tools">
                <div
                  class="device-controls"
                  role="group"
                  aria-label={t('Preview width')}
                >
                  <button
                    class="icon-button"
                    title={t('Wide preview')}
                    aria-label={t('Wide preview')}
                    aria-pressed={device === 'wide'}
                    onClick={() => setDevice('wide')}
                  >
                    <Icon name="monitor" />
                  </button>
                  <button
                    class="icon-button"
                    title={t('Phone preview')}
                    aria-label={t('Phone preview')}
                    aria-pressed={device === 'phone'}
                    onClick={() => setDevice('phone')}
                  >
                    <Icon name="phone" />
                  </button>
                </div>
                <details
                  class="example-menu"
                  ref={examplesMenu}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape' && event.currentTarget.open) {
                      event.preventDefault()
                      event.currentTarget.open = false
                      event.currentTarget.querySelector('summary')?.focus()
                    }
                  }}
                >
                  <summary>
                    {t('Examples')}
                    <Icon name="down" />
                  </summary>
                  <ul>
                    {examples.map(({ preset, title }) => (
                      <li key={preset}>
                        <a
                          href={
                            './demo/' +
                            (preset === 'graphic' ? '' : preset + '/') +
                            'index.html'
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t(title)} <Icon name="external" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
                <button
                  type="button"
                  class="icon-button preview-close"
                  aria-label={t('Close preview')}
                  title={t('Close preview')}
                  onClick={closeDesktopPreview}
                >
                  <Icon name="close" />
                </button>
              </div>
            </div>
            <div
              class="preview-frame"
              data-device={previewMobileDevice}
              ref={previewFrame}
            >
              <div class="preview-bar" aria-hidden="true">
                <PreviewTab
                  title={tabText}
                  favicon={favicon}
                  motion={previewShown ? tabTitle : undefined}
                />
              </div>
              <div
                class="preview-scroll profile-viewport"
                role="region"
                aria-label={t('Live preview')}
                tabIndex={0}
              >
                <ProfilePreview
                  doc={previewDoc}
                  locale={locale}
                  shown={previewShown}
                />
              </div>
            </div>
          </div>
        </section>
      </main>
      <dialog
        ref={dialog}
        class="import-dialog"
        aria-labelledby="import-title"
        onClose={() => setPendingImport(null)}
      >
        <h2 id="import-title">{t('Replace current profile?')}</h2>
        <p>
          {t(
            'This will replace your draft with {value}. Export the current draft first if you need a copy.',
            {
              value: importName || t('an unnamed profile'),
            },
          )}
        </p>
        <div class="dialog-actions">
          <button
            class="button button-outline"
            autoFocus
            onClick={() => dialog.current?.close()}
          >
            {t('Cancel')}
          </button>
          <button
            class="button button-primary"
            onClick={() => {
              if (pendingImport) acceptImport(pendingImport)
            }}
          >
            {t('Replace profile')}
          </button>
        </div>
      </dialog>
    </CopyContext.Provider>
  )
}
