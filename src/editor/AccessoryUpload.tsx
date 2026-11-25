import { useEffect, useRef, useState } from 'preact/hooks'
import type { Accessory } from '../profile/effects'
import { normalizeAccessory } from './files'
import { errorCopy, useCopy } from './preferences'

export function AccessoryUpload({
  kind,
  change,
}: {
  kind: Accessory
  change: (image: string) => void
}) {
  const t = useCopy()
  const input = useRef<HTMLInputElement>(null)
  const operation = useRef(0)
  const [loading, setLoading] = useState(false)
  const [failure, setFailure] = useState<{ cause: unknown } | null>(null)
  useEffect(
    () => () => {
      operation.current++
    },
    [],
  )

  async function upload(file: File) {
    const request = ++operation.current
    setLoading(true)
    setFailure(null)
    try {
      const image = await normalizeAccessory(file, kind)
      if (request === operation.current) change(image)
    } catch (cause) {
      if (request === operation.current) setFailure({ cause })
    } finally {
      if (request === operation.current) setLoading(false)
    }
  }

  const label = t('Upload cursor image')
  return (
    <div class="accessory-upload">
      <button
        class="button button-outline"
        type="button"
        onClick={() => input.current?.click()}
      >
        {label}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label={label}
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (file) void upload(file)
        }}
      />
      {loading && <p role="status">{t('Reading file…')}</p>}
      {failure && (
        <p class="field-error" role="alert">
          {errorCopy(t, failure.cause, 'The file could not be opened.')}
        </p>
      )}
    </div>
  )
}
