import { useEffect, useRef, useState } from 'preact/hooks'
import {
  avatarShapes,
  backgroundKinds,
  fits,
  fontNames,
  hoverStyles,
  linkStyles,
  positions,
  presetAppearance,
  presetNames,
  ranges,
  shadows,
  variants,
  type Appearance,
} from '../profile/appearance'
import { bytesOf } from '../profile/media'
import { contrastRatio } from '../profile/colors'
import { loadBackground, loadVideoPoster } from './background-files'
import { download, importTheme } from './files'

type ChangeAppearance = (edit: (value: Appearance) => Appearance) => void

const fontLabels = {
  manrope: 'Manrope',
  'source-sans-3': 'Source Sans 3',
  'source-serif-4': 'Source Serif 4',
}
const presetLabels = {
  minimal: 'Minimal',
  midnight: 'Midnight',
  glass: 'Glass',
  neon: 'Neon',
  graphic: 'Graphic',
}

function Reset({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button
      type="button"
      class="appearance-reset"
      aria-label={'Reset ' + name}
      onClick={onClick}
    >
      Reset
    </button>
  )
}

function Range({
  label,
  value,
  bounds,
  unit = '',
  change,
  reset,
}: {
  label: string
  value: number
  bounds: readonly [number, number]
  unit?: string
  change: (value: number) => void
  reset: () => void
}) {
  return (
    <div class="appearance-field">
      <label>
        <span>
          {label}{' '}
          <output aria-hidden="true">
            {value}
            {unit}
          </output>
        </span>
        <input
          type="range"
          aria-label={label}
          min={bounds[0]}
          max={bounds[1]}
          value={value}
          onInput={(event) => change(event.currentTarget.valueAsNumber)}
        />
      </label>
      <Reset name={label} onClick={reset} />
    </div>
  )
}

function Color({
  label,
  value,
  change,
  reset,
}: {
  label: string
  value: string
  change: (value: string) => void
  reset: () => void
}) {
  return (
    <div class="appearance-field appearance-color">
      <label>
        {label}
        <div>
          <input
            type="color"
            aria-label={label}
            value={value}
            onInput={(event) => change(event.currentTarget.value)}
          />
          <span aria-hidden="true">{value.toUpperCase()}</span>
        </div>
      </label>
      <Reset name={label} onClick={reset} />
    </div>
  )
}

function Choice<const T extends string>({
  label,
  value,
  values,
  labels,
  change,
  reset,
}: {
  label: string
  value: T
  values: readonly T[]
  labels?: Partial<Record<T, string>>
  change: (value: T) => void
  reset: () => void
}) {
  return (
    <div class="appearance-field">
      <label>
        {label}
        <select
          value={value}
          onChange={(event) => {
            const next = values.find(
              (item) => item === event.currentTarget.value,
            )
            if (next) change(next)
          }}
        >
          {values.map((item) => (
            <option key={item} value={item}>
              {labels?.[item] ?? item[0]!.toUpperCase() + item.slice(1)}
            </option>
          ))}
        </select>
      </label>
      <Reset name={label} onClick={reset} />
    </div>
  )
}

function friendlySize(bytes: number) {
  return bytes >= 1024 ** 2
    ? (bytes / 1024 ** 2).toFixed(1) + ' MiB'
    : Math.ceil(bytes / 1024) + ' KiB'
}

export function AppearanceEditor({
  appearance,
  update,
  replace,
  undo,
  canUndo,
}: {
  appearance: Appearance
  update: ChangeAppearance
  replace: ChangeAppearance
  undo: () => void
  canUndo: boolean
}) {
  const { preset, variant, background, typography, card, links } = appearance
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingVideo, setPendingVideo] = useState<string | null>(null)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const posterInput = useRef<HTMLInputElement>(null)
  const themeInput = useRef<HTMLInputElement>(null)
  const resetDialog = useRef<HTMLDialogElement>(null)
  const operation = useRef(0)
  const defaults = presetAppearance(preset, variant)

  useEffect(
    () => () => {
      operation.current++
    },
    [],
  )

  function setGroup<
    K extends 'background' | 'typography' | 'card' | 'avatar' | 'links',
  >(group: K) {
    return <F extends keyof Appearance[K]>(field: F, value: Appearance[K][F]) =>
      update((current) => ({
        ...current,
        [group]: { ...current[group], [field]: value },
      }))
  }

  function resetGroup(
    group: 'background' | 'typography' | 'card' | 'avatar' | 'links',
  ) {
    if (group === 'background') clearOperation()
    update((current) => ({
      ...current,
      [group]: presetAppearance(current.preset, current.variant)[group],
    }))
  }

  const setBackground = setGroup('background')
  const setTypography = setGroup('typography')
  const setCard = setGroup('card')
  const setAvatar = setGroup('avatar')
  const setLinks = setGroup('links')
  const removeMedia = () => {
    clearOperation()
    update((current) => ({
      ...current,
      background: { ...current.background, kind: 'color', media: null },
    }))
  }

  function clearOperation() {
    operation.current++
    setLoading(false)
    setError('')
    setStatus('')
    setPendingVideo(null)
  }

  function applyPreset(next: typeof preset) {
    clearOperation()
    replace(() => presetAppearance(next))
  }

  function applyVariant(next: typeof variant) {
    update((current) => {
      const target = presetAppearance(current.preset, next)
      return {
        ...current,
        variant: next,
        accent: target.accent,
        background: {
          ...current.background,
          color: target.background.color,
          endColor: target.background.endColor,
        },
        typography: {
          ...current.typography,
          color: target.typography.color,
          bioColor: target.typography.bioColor,
        },
        card: {
          ...current.card,
          color: target.card.color,
          borderColor: target.card.borderColor,
        },
        links: {
          ...current.links,
          color: target.links.color,
          text: target.links.text,
          borderColor: target.links.borderColor,
        },
      }
    })
  }

  async function selectFile(
    file: File,
    category: 'background' | 'poster' | 'theme',
  ) {
    const id = ++operation.current
    setError('')
    setStatus('')
    setLoading(true)
    if (category !== 'poster') setPendingVideo(null)
    try {
      if (category === 'theme') {
        const theme = await importTheme(file)
        if (operation.current !== id) return
        replace(() => theme.appearance)
        setStatus('Theme applied.')
        return
      }
      const media =
        category === 'poster' && pendingVideo
          ? {
              type: 'video/mp4' as const,
              data: pendingVideo,
              poster: await loadVideoPoster(file),
            }
          : await loadBackground(file)
      if (operation.current !== id) return
      if ('needsPoster' in media) {
        setPendingVideo(media.needsPoster)
        setStatus(
          'This browser could not open the local video. Choose a still image to use as its poster.',
        )
        return
      }
      update((current) => ({
        ...current,
        background: { ...current.background, kind: 'media', media },
      }))
      setStatus(
        category === 'poster'
          ? 'Video added. The preview may show the poster only.'
          : 'Background added.',
      )
      setPendingVideo(null)
    } catch (failure) {
      if (operation.current === id)
        setError(
          failure instanceof Error
            ? failure.message
            : 'The file could not be opened.',
        )
    } finally {
      if (operation.current === id) setLoading(false)
    }
  }

  function exportTheme() {
    const blob = new Blob(
      [
        JSON.stringify(
          { type: 'rvnce-theme', schemaVersion: 1, appearance },
          null,
          2,
        ) + '\n',
      ],
      { type: 'application/json' },
    )
    download(blob, 'rvnce-theme.json')
    setStatus('Theme downloaded.')
  }

  const media = background.media
  const mediaSize = media
    ? bytesOf(media.data) + ('poster' in media ? bytesOf(media.poster) : 0)
    : 0
  const lowContrast =
    (card.opacity === 100 &&
      (contrastRatio(typography.bioColor, card.color) < 4.5 ||
        contrastRatio(typography.color, card.color) < 3)) ||
    (card.opacity === 0 &&
      background.kind === 'color' &&
      (contrastRatio(typography.bioColor, background.color) < 4.5 ||
        contrastRatio(typography.color, background.color) < 3)) ||
    ((links.style === 'solid' || links.style === 'soft') &&
      contrastRatio(links.text, links.color) < 4.5)
  const range = (
    label: string,
    value: number,
    bounds: readonly [number, number],
    change: (value: number) => void,
    reset: () => void,
    unit?: string,
  ) => (
    <Range
      label={label}
      value={value}
      bounds={bounds}
      change={change}
      reset={reset}
      unit={unit ?? ''}
    />
  )
  const color = (
    label: string,
    value: string,
    change: (value: string) => void,
    reset: () => void,
  ) => <Color label={label} value={value} change={change} reset={reset} />

  return (
    <div class="appearance-editor">
      <fieldset class="appearance-fieldset">
        <legend>Presets</legend>
        <div class="preset-options">
          {presetNames.map((name) => (
            <button
              type="button"
              class="preset-button"
              key={name}
              data-preset={name}
              aria-pressed={preset === name}
              onClick={() => applyPreset(name)}
            >
              <span class="preset-sample" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              {presetLabels[name]}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset class="appearance-fieldset">
        <legend>Palette</legend>
        <div class="theme-options">
          {variants.map((value) => (
            <label class="theme-option" key={value}>
              <input
                type="radio"
                name="variant"
                checked={variant === value}
                onChange={() => applyVariant(value)}
              />
              {value === 'light' ? 'Light' : 'Dark'}
            </label>
          ))}
        </div>
      </fieldset>
      <div class="appearance-actions">
        <button
          type="button"
          class="button button-outline"
          onClick={() => themeInput.current?.click()}
        >
          Import theme
        </button>
        <button
          type="button"
          class="button button-outline"
          onClick={exportTheme}
        >
          Export theme
          {mediaSize >= 1024 ** 2 &&
            ' · ' + friendlySize(Math.ceil((mediaSize * 4) / 3))}
        </button>
        <input
          ref={themeInput}
          type="file"
          accept=".json"
          aria-label="Theme file"
          hidden
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (file) void selectFile(file, 'theme')
          }}
        />
      </div>
      {loading && <p role="status">Reading file…</p>}
      {status && <p role="status">{status}</p>}
      {error && (
        <p class="field-error" role="alert">
          {error}
        </p>
      )}
      {lowContrast && (
        <p class="field-error">
          Some text colors have low contrast. Choose a lighter or darker color.
        </p>
      )}
      <details class="appearance-group" open>
        <summary>Background</summary>
        <div class="appearance-fields">
          <Choice
            label="Background type"
            value={background.kind}
            values={media ? backgroundKinds : ['color', 'linear', 'radial']}
            change={(kind) => {
              if (kind !== 'media') clearOperation()
              update((current) => ({
                ...current,
                background: {
                  ...current.background,
                  kind,
                  media: kind === 'media' ? current.background.media : null,
                },
              }))
            }}
            reset={() => resetGroup('background')}
          />
          {color(
            'Background color',
            background.color,
            (value) => setBackground('color', value),
            () => setBackground('color', defaults.background.color),
          )}
          {(background.kind === 'linear' || background.kind === 'radial') &&
            color(
              'Gradient color',
              background.endColor,
              (value) => setBackground('endColor', value),
              () => setBackground('endColor', defaults.background.endColor),
            )}
          {background.kind === 'linear' &&
            range(
              'Gradient angle',
              background.angle,
              ranges.angle,
              (value) => setBackground('angle', value),
              () => setBackground('angle', defaults.background.angle),
              '°',
            )}
          {(media || background.kind === 'radial') && (
            <>
              {range(
                'Horizontal position',
                background.x,
                ranges.percent,
                (value) => setBackground('x', value),
                () => setBackground('x', defaults.background.x),
                '%',
              )}
              {range(
                'Vertical position',
                background.y,
                ranges.percent,
                (value) => setBackground('y', value),
                () => setBackground('y', defaults.background.y),
                '%',
              )}
            </>
          )}
          {media && (
            <>
              <Choice
                label="Image fit"
                value={background.fit}
                values={fits}
                change={(value) => setBackground('fit', value)}
                reset={() => setBackground('fit', defaults.background.fit)}
              />
              {range(
                'Scale',
                background.scale,
                ranges.scale,
                (value) => setBackground('scale', value),
                () => setBackground('scale', defaults.background.scale),
                '%',
              )}
              {range(
                'Dimming',
                background.dim,
                ranges.percent,
                (value) => setBackground('dim', value),
                () => setBackground('dim', defaults.background.dim),
                '%',
              )}
              {range(
                'Background blur',
                background.blur,
                ranges.blur,
                (value) => setBackground('blur', value),
                () => setBackground('blur', defaults.background.blur),
                ' px',
              )}
            </>
          )}
          <div class="appearance-actions">
            <button
              type="button"
              class="button button-outline"
              onClick={() => fileInput.current?.click()}
            >
              {media ? 'Change background file' : 'Upload background'}
            </button>
            {media && (
              <button
                type="button"
                class="button button-quiet"
                onClick={removeMedia}
              >
                Remove background file
              </button>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,video/mp4"
              aria-label="Background file"
              hidden
              onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                event.currentTarget.value = ''
                if (file) void selectFile(file, 'background')
              }}
            />
          </div>
          {pendingVideo && (
            <div class="appearance-actions">
              <button
                type="button"
                class="button button-outline"
                onClick={() => posterInput.current?.click()}
              >
                Upload video poster
              </button>
              <button
                type="button"
                class="button button-quiet"
                onClick={clearOperation}
              >
                Cancel video upload
              </button>
              <input
                ref={posterInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                aria-label="Video poster file"
                hidden
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0]
                  event.currentTarget.value = ''
                  if (file) void selectFile(file, 'poster')
                }}
              />
            </div>
          )}
          {media ? (
            <p class="hint">
              {friendlySize(mediaSize)}
              {'poster' in media &&
                ' · Original motion files retain metadata. MP4 files may contain audio.'}
            </p>
          ) : (
            <p class="hint">
              PNG, JPEG or WebP up to 8 MiB. GIF up to 3 MiB. H.264 MP4 up to 8
              MiB and 15 seconds.
            </p>
          )}
          <Reset
            name="Background group"
            onClick={() => resetGroup('background')}
          />
        </div>
      </details>
      <details class="appearance-group">
        <summary>Typography</summary>
        <div class="appearance-fields">
          <Choice
            label="Font"
            value={typography.font}
            values={fontNames}
            labels={fontLabels}
            change={(value) => setTypography('font', value)}
            reset={() => setTypography('font', defaults.typography.font)}
          />
          <Choice
            label="Text alignment"
            value={typography.align}
            values={positions}
            change={(value) => setTypography('align', value)}
            reset={() => setTypography('align', defaults.typography.align)}
          />
          {range(
            'Name size',
            typography.nameSize,
            ranges.nameSize,
            (value) => setTypography('nameSize', value),
            () => setTypography('nameSize', defaults.typography.nameSize),
            ' px',
          )}
          {range(
            'Name weight',
            typography.nameWeight,
            ranges.weight,
            (value) => setTypography('nameWeight', value),
            () => setTypography('nameWeight', defaults.typography.nameWeight),
          )}
          {color(
            'Name color',
            typography.color,
            (value) => setTypography('color', value),
            () => setTypography('color', defaults.typography.color),
          )}
          {range(
            'Bio size',
            typography.bioSize,
            ranges.bioSize,
            (value) => setTypography('bioSize', value),
            () => setTypography('bioSize', defaults.typography.bioSize),
            ' px',
          )}
          {range(
            'Bio weight',
            typography.bioWeight,
            ranges.weight,
            (value) => setTypography('bioWeight', value),
            () => setTypography('bioWeight', defaults.typography.bioWeight),
          )}
          {color(
            'Bio color',
            typography.bioColor,
            (value) => setTypography('bioColor', value),
            () => setTypography('bioColor', defaults.typography.bioColor),
          )}
          <Reset
            name="Typography group"
            onClick={() => resetGroup('typography')}
          />
        </div>
      </details>
      <details class="appearance-group">
        <summary>Card and avatar</summary>
        <div class="appearance-fields">
          {range(
            'Card width',
            card.width,
            ranges.width,
            (value) => setCard('width', value),
            () => setCard('width', defaults.card.width),
            ' px',
          )}
          {range(
            'Card padding',
            card.padding,
            ranges.padding,
            (value) => setCard('padding', value),
            () => setCard('padding', defaults.card.padding),
            ' px',
          )}
          {color(
            'Card color',
            card.color,
            (value) => setCard('color', value),
            () => setCard('color', defaults.card.color),
          )}
          {range(
            'Card opacity',
            card.opacity,
            ranges.percent,
            (value) => setCard('opacity', value),
            () => setCard('opacity', defaults.card.opacity),
            '%',
          )}
          {range(
            'Card radius',
            card.radius,
            ranges.radius,
            (value) => setCard('radius', value),
            () => setCard('radius', defaults.card.radius),
            ' px',
          )}
          {range(
            'Card backdrop blur',
            card.blur,
            ranges.blur,
            (value) => setCard('blur', value),
            () => setCard('blur', defaults.card.blur),
            ' px',
          )}
          {range(
            'Card border',
            card.border,
            ranges.border,
            (value) => setCard('border', value),
            () => setCard('border', defaults.card.border),
            ' px',
          )}
          {color(
            'Card border color',
            card.borderColor,
            (value) => setCard('borderColor', value),
            () => setCard('borderColor', defaults.card.borderColor),
          )}
          <Choice
            label="Card shadow"
            value={card.shadow}
            values={shadows}
            change={(value) => setCard('shadow', value)}
            reset={() => setCard('shadow', defaults.card.shadow)}
          />
          <Reset name="Card group" onClick={() => resetGroup('card')} />
          <Choice
            label="Avatar position"
            value={appearance.avatar.position}
            values={['above', 'start', 'end']}
            change={(value) => setAvatar('position', value)}
            reset={() => setAvatar('position', defaults.avatar.position)}
          />
          <Choice
            label="Avatar shape"
            value={appearance.avatar.shape}
            values={avatarShapes}
            change={(value) => setAvatar('shape', value)}
            reset={() => setAvatar('shape', defaults.avatar.shape)}
          />
          {range(
            'Avatar size',
            appearance.avatar.size,
            ranges.avatarSize,
            (value) => setAvatar('size', value),
            () => setAvatar('size', defaults.avatar.size),
            ' px',
          )}
          {color(
            'Accent color',
            appearance.accent,
            (value) => update((current) => ({ ...current, accent: value })),
            () =>
              update((current) => ({ ...current, accent: defaults.accent })),
          )}
          <Reset
            name="Avatar group"
            onClick={() => {
              resetGroup('avatar')
              update((current) => ({ ...current, accent: defaults.accent }))
            }}
          />
        </div>
      </details>
      <details class="appearance-group">
        <summary>Link style</summary>
        <div class="appearance-fields">
          <Choice
            label="Link style"
            value={links.style}
            values={linkStyles}
            change={(value) => setLinks('style', value)}
            reset={() => setLinks('style', defaults.links.style)}
          />
          {color(
            'Link color',
            links.color,
            (value) => setLinks('color', value),
            () => setLinks('color', defaults.links.color),
          )}
          {color(
            'Link text color',
            links.text,
            (value) => setLinks('text', value),
            () => setLinks('text', defaults.links.text),
          )}
          {range(
            'Link radius',
            links.radius,
            ranges.radius,
            (value) => setLinks('radius', value),
            () => setLinks('radius', defaults.links.radius),
            ' px',
          )}
          {range(
            'Link border',
            links.border,
            ranges.border,
            (value) => setLinks('border', value),
            () => setLinks('border', defaults.links.border),
            ' px',
          )}
          {color(
            'Link border color',
            links.borderColor,
            (value) => setLinks('borderColor', value),
            () => setLinks('borderColor', defaults.links.borderColor),
          )}
          <Choice
            label="Link shadow"
            value={links.shadow}
            values={shadows}
            change={(value) => setLinks('shadow', value)}
            reset={() => setLinks('shadow', defaults.links.shadow)}
          />
          {range(
            'Link height',
            links.height,
            ranges.linkHeight,
            (value) => setLinks('height', value),
            () => setLinks('height', defaults.links.height),
            ' px',
          )}
          {range(
            'Link spacing',
            links.gap,
            ranges.gap,
            (value) => setLinks('gap', value),
            () => setLinks('gap', defaults.links.gap),
            ' px',
          )}
          <Choice
            label="Link hover effect"
            value={links.hover}
            values={hoverStyles}
            change={(value) => setLinks('hover', value)}
            reset={() => setLinks('hover', defaults.links.hover)}
          />
          <Reset name="Link group" onClick={() => resetGroup('links')} />
        </div>
      </details>
      <label class="appearance-check">
        <input
          type="checkbox"
          checked={appearance.entrance}
          onChange={(event) => {
            const entrance = event.currentTarget.checked
            update((current) => ({ ...current, entrance }))
          }}
        />
        Animate profile entrance
      </label>
      <div class="appearance-actions">
        {canUndo && (
          <button
            type="button"
            class="button button-quiet"
            onClick={() => {
              clearOperation()
              undo()
            }}
          >
            Undo appearance change
          </button>
        )}
        <button
          type="button"
          class="button button-quiet"
          onClick={() => resetDialog.current?.showModal()}
        >
          Reset appearance
        </button>
      </div>
      <dialog
        ref={resetDialog}
        class="import-dialog"
        aria-labelledby="reset-title"
      >
        <h2 id="reset-title">Reset appearance?</h2>
        <p>Your profile will use the default Minimal preset.</p>
        <div class="dialog-actions">
          <button
            type="button"
            class="button button-outline"
            autoFocus
            onClick={() => resetDialog.current?.close()}
          >
            Cancel
          </button>
          <button
            type="button"
            class="button button-primary"
            onClick={() => {
              applyPreset('minimal')
              resetDialog.current?.close()
            }}
          >
            Reset to Minimal
          </button>
        </div>
      </dialog>
    </div>
  )
}
