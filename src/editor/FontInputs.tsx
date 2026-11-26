import { useLayoutEffect, useRef, useState } from 'preact/hooks'
import { parseFontUrl, type ProfileFont } from '../profile/fonts'
import { uploadFont, type FontStatus } from './custom-font'
import { errorCopy, useCopy } from './preferences'

export function FontInputs({
  font,
  status,
  change,
}: {
  font: ProfileFont
  status: FontStatus
  change: (font: ProfileFont) => void
}) {
  const t = useCopy()
  const savedUrl =
    typeof font === 'object' && font.source === 'url' ? font.url : ''
  const [url, setUrl] = useState(savedUrl)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ cause: unknown } | null>(null)
  const operation = useRef(0)
  const picker = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => {
    setUrl(savedUrl)
    setBusy(false)
    setError(null)
    return () => {
      operation.current++
    }
  }, [font, savedUrl])

  async function chooseFile(file: File) {
    const attempt = ++operation.current
    setError(null)
    setBusy(true)
    try {
      const loaded = await uploadFont(file)
      if (attempt === operation.current) change(loaded)
    } catch (cause) {
      if (attempt === operation.current) setError({ cause })
    } finally {
      if (attempt === operation.current) setBusy(false)
    }
  }

  function chooseUrl() {
    operation.current++
    setBusy(false)
    setError(null)
    try {
      change({ source: 'url', url: parseFontUrl(url) })
    } catch (cause) {
      setError({ cause })
    }
  }

  return (
    <div class="custom-font-settings">
      <input
        hidden
        type="file"
        ref={picker}
        accept=".woff2,font/woff2"
        aria-label={t('Custom font file')}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (file) void chooseFile(file)
        }}
      />
      <button
        type="button"
        class="button button-outline"
        disabled={busy}
        onClick={() => picker.current?.click()}
      >
        {t(busy ? 'Processing…' : 'Upload WOFF2 font')}
      </button>
      <div class="appearance-field">
        <label class="field">
          <span>{t('Font URL')}</span>
          <input
            type="url"
            value={url}
            placeholder="https://"
            maxLength={2048}
            onInput={(event) => setUrl(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                chooseUrl()
              }
            }}
          />
        </label>
        <button
          type="button"
          class="button button-outline"
          disabled={!url.trim()}
          onClick={chooseUrl}
        >
          {t('Use font URL')}
        </button>
      </div>
      {error && (
        <p class="field-error" role="alert">
          {errorCopy(t, error.cause)}
        </p>
      )}
      {!error && status === 'failed' && (
        <p class="field-error" role="alert">
          {t(
            savedUrl
              ? 'The font URL could not be loaded. Allow cross-origin font requests.'
              : 'The uploaded font could not be loaded.',
          )}
        </p>
      )}
      {status === 'loading' && (
        <p class="hint" role="status">
          {t('Loading custom font…')}
        </p>
      )}
    </div>
  )
}
