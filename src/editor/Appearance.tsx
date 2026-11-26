import type { ComponentChildren } from 'preact'
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import {
  avatarShapes,
  backgroundKinds,
  fits,
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
import { fontNames } from '../profile/fonts'
import { bytesOf } from '../profile/media'
import {
  clicks,
  cursors,
  nameMotions,
  namePresets,
  overlayDefaults,
  overlays,
  trails,
  type ProfileEffects,
} from '../profile/effects'
import { contrastRatio } from '../profile/colors'
import { themeVersion } from '../profile/document'
import { AccessoryUpload } from './AccessoryUpload'
import { FontInputs } from './FontInputs'
import type { FontStatus } from './custom-font'
import { loadBackground, loadVideoPoster } from './background-files'
import { download, importTheme } from './files'
import { Icon } from './Icon'
import type { Message } from './messages'
import { errorCopy, useCopy } from './preferences'

type ChangeAppearance = (edit: (value: Appearance) => Appearance) => void

const fontLabels = {
  manrope: 'Manrope',
  inter: 'Inter',
  'source-sans-3': 'Source Sans 3',
  'source-serif-4': 'Source Serif 4',
  'roboto-mono': 'Roboto Mono',
  oswald: 'Oswald',
}
const presetLabels = {
  minimal: 'Minimal',
  midnight: 'Midnight',
  glass: 'Glass',
  neon: 'Neon',
  graphic: 'Graphic',
} as const

const optionLabels = {
  color: 'Color',
  linear: 'Linear',
  radial: 'Radial',
  media: 'Media',
  cover: 'Cover',
  contain: 'Contain',
  start: 'Start',
  center: 'Center',
  end: 'End',
  above: 'Above',
  circle: 'Circle',
  rounded: 'Rounded',
  square: 'Square',
  graphic: 'Graphic',
  solid: 'Solid',
  outline: 'Outline',
  soft: 'Soft',
  deep: 'Deep',
  none: 'None',
  lift: 'Lift',
  slide: 'Slide',
  default: 'Default cursor',
  cell: 'Grid cursor',
  crosshair: 'Crosshair',
  pixel: 'Pixel arrow',
  neon: 'Neon pointer',
  reticle: 'Precision reticle',
  custom: 'Custom image',
  'custom-font': 'Custom font',
  ghost: 'Ghost trail',
  sparkles: 'Sparkles',
  snow: 'Snow',
  particles: 'Floating particles',
  grain: 'Film grain',
  glitch: 'Glitch',
  matrix: 'Matrix rain',
  dust: 'Film dust',
  embers: 'Drifting embers',
  ripple: 'Ripple',
  burst: 'Particle burst',
  glow: 'Glow',
  gradient: 'Animated gradient',
  typewriter: 'Typewriter',
  pulse: 'Soft pulse',
  stagger: 'Staggered reveal',
} as const satisfies Record<string, Message>

const dialogs = {
  background: 'Background',
  overlay: 'Page overlay',
  click: 'Click effects',
  name: 'Display name effects',
  cursor: 'Cursor and trail',
  motion: 'Profile entrance',
} as const

type AppearanceDialog = keyof typeof dialogs

function Reset({ name, onClick }: { name: string; onClick: () => void }) {
  const t = useCopy()
  return (
    <button
      type="button"
      class="appearance-reset"
      aria-label={t('Reset {value}', { value: name })}
      onClick={onClick}
    >
      {t('Reset')}
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

function Choice<
  const T extends keyof typeof optionLabels | keyof typeof fontLabels,
>({
  label,
  value,
  values,
  change,
  reset,
}: {
  label: string
  value: T
  values: readonly T[]
  change: (value: T) => void
  reset: () => void
}) {
  const t = useCopy()
  return (
    <div class="appearance-field">
      <label>
        {label}
        <select
          aria-label={label}
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
              {item in fontLabels
                ? fontLabels[item as keyof typeof fontLabels]
                : t(optionLabels[item as keyof typeof optionLabels])}
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
  renderPreview,
  fontStatus,
}: {
  appearance: Appearance
  update: ChangeAppearance
  replace: ChangeAppearance
  undo: () => void
  canUndo: boolean
  renderPreview: (key: number) => ComponentChildren
  fontStatus: FontStatus
}) {
  const t = useCopy()
  const { preset, variant, background, typography, card, links, effects } =
    appearance
  const [activeDialog, setActiveDialog] = useState<AppearanceDialog | null>(
    null,
  )
  const [previewKey, setPreviewKey] = useState(0)
  const appearanceDialog = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLButtonElement>(null)
  const [status, setStatus] = useState<Message | ''>('')
  const [loading, setLoading] = useState(false)
  const [pendingVideo, setPendingVideo] = useState<string | null>(null)
  const [error, setError] = useState<{ cause: unknown } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const posterInput = useRef<HTMLInputElement>(null)
  const themeInput = useRef<HTMLInputElement>(null)
  const resetDialog = useRef<HTMLDialogElement>(null)
  const operation = useRef(0)
  const defaults = presetAppearance(preset, variant)

  useLayoutEffect(() => {
    if (activeDialog && !appearanceDialog.current?.open)
      appearanceDialog.current?.showModal()
  }, [activeDialog])

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
  function setEffect<K extends keyof ProfileEffects>(
    key: K,
    edit: (current: ProfileEffects[K]) => ProfileEffects[K],
  ) {
    update((current) => ({
      ...current,
      effects: { ...current.effects, [key]: edit(current.effects[key]) },
    }))
  }
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
    setError(null)
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
    setError(null)
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
      if (operation.current === id) setError({ cause: failure })
    } finally {
      if (operation.current === id) setLoading(false)
    }
  }

  function exportTheme() {
    const blob = new Blob(
      [
        JSON.stringify(
          { type: 'rvnce-theme', schemaVersion: themeVersion, appearance },
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

  const fileStatus = (
    <>
      {loading && <p role="status">{t('Reading file…')}</p>}
      {status && <p role="status">{t(status)}</p>}
      {error && (
        <p class="field-error" role="alert">
          {errorCopy(t, error.cause, 'The file could not be opened.')}
        </p>
      )}
    </>
  )
  const backgroundControls = (
    <div class="appearance-fields">
      {fileStatus}
      <Choice
        label={t('Background type')}
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
        t('Background color'),
        background.color,
        (value) => setBackground('color', value),
        () => setBackground('color', defaults.background.color),
      )}
      {(background.kind === 'linear' || background.kind === 'radial') &&
        color(
          t('Gradient color'),
          background.endColor,
          (value) => setBackground('endColor', value),
          () => setBackground('endColor', defaults.background.endColor),
        )}
      {background.kind === 'linear' &&
        range(
          t('Gradient angle'),
          background.angle,
          ranges.angle,
          (value) => setBackground('angle', value),
          () => setBackground('angle', defaults.background.angle),
          '°',
        )}
      {(media || background.kind === 'radial') && (
        <>
          {range(
            t('Horizontal position'),
            background.x,
            ranges.percent,
            (value) => setBackground('x', value),
            () => setBackground('x', defaults.background.x),
            '%',
          )}
          {range(
            t('Vertical position'),
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
            label={t('Image fit')}
            value={background.fit}
            values={fits}
            change={(value) => setBackground('fit', value)}
            reset={() => setBackground('fit', defaults.background.fit)}
          />
          {range(
            t('Scale'),
            background.scale,
            ranges.scale,
            (value) => setBackground('scale', value),
            () => setBackground('scale', defaults.background.scale),
            '%',
          )}
          {range(
            t('Dimming'),
            background.dim,
            ranges.percent,
            (value) => setBackground('dim', value),
            () => setBackground('dim', defaults.background.dim),
            '%',
          )}
          {range(
            t('Background blur'),
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
          {t(media ? 'Change background file' : 'Upload background')}
        </button>
        {media && (
          <button
            type="button"
            class="button button-quiet"
            onClick={removeMedia}
          >
            {t('Remove background file')}
          </button>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,video/mp4"
          aria-label={t('Background file')}
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
            {t('Upload video poster')}
          </button>
          <button
            type="button"
            class="button button-quiet"
            onClick={clearOperation}
          >
            {t('Cancel video upload')}
          </button>
          <input
            ref={posterInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label={t('Video poster file')}
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
            ' · ' +
              t(
                'Original motion files retain metadata. MP4 files may contain audio.',
              )}
        </p>
      ) : (
        <p class="hint">
          {t(
            'PNG, JPEG or WebP up to 8 MiB. GIF up to 3 MiB. H.264 MP4 up to 8 MiB.',
          )}
        </p>
      )}
      <Reset
        name={t('Background group')}
        onClick={() => resetGroup('background')}
      />
    </div>
  )

  const controls = {
    background: backgroundControls,
    overlay: (
      <div class="appearance-fields">
        <Choice
          label={t('Overlay preset')}
          value={effects.overlay.preset}
          values={overlays}
          change={(preset) =>
            setEffect('overlay', () => overlayDefaults(preset))
          }
          reset={() => setEffect('overlay', () => defaults.effects.overlay)}
        />
        {effects.overlay.preset !== 'none' && (
          <>
            {color(
              t('Overlay color'),
              effects.overlay.color,
              (color) =>
                setEffect('overlay', (current) => ({ ...current, color })),
              () =>
                setEffect('overlay', (current) => ({
                  ...current,
                  color: overlayDefaults(current.preset).color,
                })),
            )}
            {range(
              t(
                effects.overlay.preset === 'glitch'
                  ? 'Glitch frequency'
                  : effects.overlay.preset === 'matrix'
                    ? 'Rain density'
                    : 'Overlay intensity',
              ),
              effects.overlay.intensity,
              ranges.percent,
              (intensity) =>
                setEffect('overlay', (current) => ({ ...current, intensity })),
              () =>
                setEffect('overlay', (current) => ({
                  ...current,
                  intensity: overlayDefaults(current.preset).intensity,
                })),
              '%',
            )}
          </>
        )}
      </div>
    ),
    click: (
      <div class="appearance-fields">
        <Choice
          label={t('Click effect preset')}
          value={effects.click.preset}
          values={clicks}
          change={(preset) =>
            setEffect('click', (current) => ({ ...current, preset }))
          }
          reset={() => setEffect('click', () => defaults.effects.click)}
        />
        {effects.click.preset !== 'none' &&
          color(
            t('Click effect color'),
            effects.click.color,
            (color) => setEffect('click', (current) => ({ ...current, color })),
            () =>
              setEffect('click', (current) => ({
                ...current,
                color: defaults.effects.click.color,
              })),
          )}
      </div>
    ),
    name: (
      <div class="appearance-fields">
        <label class="appearance-check">
          <input
            type="checkbox"
            checked={effects.sparkles.enabled}
            onChange={(event) => {
              const enabled = event.currentTarget.checked
              setEffect('sparkles', (current) => ({ ...current, enabled }))
            }}
          />
          {t('Sparkles around the name')}
        </label>
        {color(
          t('Sparkle color'),
          effects.sparkles.color,
          (color) =>
            setEffect('sparkles', (current) => ({ ...current, color })),
          () =>
            setEffect('sparkles', (current) => ({
              ...current,
              color: defaults.effects.sparkles.color,
            })),
        )}
        <label class="appearance-check">
          <input
            type="checkbox"
            checked={effects.name.enabled}
            onChange={(event) => {
              const enabled = event.currentTarget.checked
              setEffect('name', (current) => ({ ...current, enabled }))
            }}
          />
          {t('Style the name text')}
        </label>
        <Choice
          label={t('Name effect preset')}
          value={effects.name.preset}
          values={namePresets}
          change={(preset) =>
            setEffect('name', (current) => ({ ...current, preset }))
          }
          reset={() =>
            setEffect('name', (current) => ({
              ...current,
              preset: defaults.effects.name.preset,
            }))
          }
        />
        <Choice
          label={t('Name animation')}
          value={effects.nameMotion.preset}
          values={nameMotions}
          change={(preset) =>
            setEffect('nameMotion', (current) => ({ ...current, preset }))
          }
          reset={() =>
            setEffect('nameMotion', () => defaults.effects.nameMotion)
          }
        />
        {effects.nameMotion.preset !== 'none' &&
          range(
            t('Name animation speed'),
            effects.nameMotion.speed,
            ranges.percent,
            (speed) =>
              setEffect('nameMotion', (current) => ({ ...current, speed })),
            () =>
              setEffect('nameMotion', (current) => ({
                ...current,
                speed: defaults.effects.nameMotion.speed,
              })),
            '%',
          )}
        {effects.nameMotion.preset === 'typewriter' && (
          <label class="appearance-check">
            <input
              type="checkbox"
              checked={effects.nameMotion.caret}
              onChange={(event) => {
                const caret = event.currentTarget.checked
                setEffect('nameMotion', (current) => ({ ...current, caret }))
              }}
            />
            {t('Blinking caret')}
          </label>
        )}
      </div>
    ),
    cursor: (
      <div class="appearance-fields">
        <Choice
          label={t('Cursor preset')}
          value={effects.cursor.preset}
          values={cursors.filter(
            (preset) => preset !== 'custom' || effects.cursor.image,
          )}
          change={(preset) =>
            setEffect('cursor', (current) => ({ ...current, preset }))
          }
          reset={() => setEffect('cursor', () => defaults.effects.cursor)}
        />
        <AccessoryUpload
          kind="cursor"
          change={(image) =>
            setEffect('cursor', () => ({ preset: 'custom', image }))
          }
        />
        <Choice
          label={t('Cursor trail')}
          value={effects.trail}
          values={trails}
          change={(trail) => setEffect('trail', () => trail)}
          reset={() => setEffect('trail', () => defaults.effects.trail)}
        />
      </div>
    ),
    motion: (
      <label class="appearance-check">
        <input
          type="checkbox"
          checked={appearance.entrance}
          onChange={(event) => {
            const entrance = event.currentTarget.checked
            update((current) => ({ ...current, entrance }))
          }}
        />
        {t('Animate profile entrance')}
      </label>
    ),
  }

  return (
    <div class="appearance-editor">
      <fieldset class="appearance-fieldset">
        <legend>{t('Presets')}</legend>
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
              {t(presetLabels[name])}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset class="appearance-fieldset">
        <legend>{t('Palette')}</legend>
        <div class="theme-options">
          {variants.map((value) => (
            <label class="theme-option" key={value}>
              <input
                type="radio"
                name="variant"
                checked={variant === value}
                onChange={() => applyVariant(value)}
              />
              {t(value === 'light' ? 'Light' : 'Dark')}
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
          {t('Import theme')}
        </button>
        <button
          type="button"
          class="button button-outline"
          onClick={exportTheme}
        >
          {t('Export theme')}
          {mediaSize >= 1024 ** 2 &&
            ' · ' + friendlySize(Math.ceil((mediaSize * 4) / 3))}
        </button>
        <input
          ref={themeInput}
          type="file"
          accept=".json"
          aria-label={t('Theme file')}
          hidden
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (file) void selectFile(file, 'theme')
          }}
        />
      </div>
      {activeDialog !== 'background' && fileStatus}
      {lowContrast && (
        <p class="field-error">
          {t(
            'Some text colors have low contrast. Choose a lighter or darker color.',
          )}
        </p>
      )}
      <div class="appearance-dialog-openers">
        {(Object.keys(dialogs) as AppearanceDialog[]).map((key) => (
          <button
            type="button"
            class="appearance-dialog-opener"
            key={key}
            aria-haspopup="dialog"
            onClick={(event) => {
              opener.current = event.currentTarget
              setActiveDialog(key)
            }}
          >
            {t(dialogs[key])}
            <Icon name="right" />
          </button>
        ))}
      </div>
      <details class="appearance-group">
        <summary>
          {t('Typography')}
          <Icon name="down" />
        </summary>
        <div class="appearance-fields">
          <Choice
            label={t('Font')}
            value={
              typeof typography.font === 'string'
                ? typography.font
                : 'custom-font'
            }
            values={
              typeof typography.font === 'string'
                ? fontNames
                : [...fontNames, 'custom-font' as const]
            }
            change={(value) => {
              if (value !== 'custom-font') setTypography('font', value)
            }}
            reset={() => setTypography('font', defaults.typography.font)}
          />
          <FontInputs
            font={typography.font}
            status={fontStatus}
            change={(font) => setTypography('font', font)}
          />
          <Choice
            label={t('Text alignment')}
            value={typography.align}
            values={positions}
            change={(value) => setTypography('align', value)}
            reset={() => setTypography('align', defaults.typography.align)}
          />
          {range(
            t('Name size'),
            typography.nameSize,
            ranges.nameSize,
            (value) => setTypography('nameSize', value),
            () => setTypography('nameSize', defaults.typography.nameSize),
            ' px',
          )}
          {range(
            t('Name weight'),
            typography.nameWeight,
            ranges.weight,
            (value) => setTypography('nameWeight', value),
            () => setTypography('nameWeight', defaults.typography.nameWeight),
          )}
          {color(
            t('Name color'),
            typography.color,
            (value) => setTypography('color', value),
            () => setTypography('color', defaults.typography.color),
          )}
          {range(
            t('Bio size'),
            typography.bioSize,
            ranges.bioSize,
            (value) => setTypography('bioSize', value),
            () => setTypography('bioSize', defaults.typography.bioSize),
            ' px',
          )}
          {range(
            t('Bio weight'),
            typography.bioWeight,
            ranges.weight,
            (value) => setTypography('bioWeight', value),
            () => setTypography('bioWeight', defaults.typography.bioWeight),
          )}
          {color(
            t('Bio color'),
            typography.bioColor,
            (value) => setTypography('bioColor', value),
            () => setTypography('bioColor', defaults.typography.bioColor),
          )}
          <Reset
            name={t('Typography group')}
            onClick={() => resetGroup('typography')}
          />
        </div>
      </details>
      <details class="appearance-group">
        <summary>
          {t('Card and avatar')}
          <Icon name="down" />
        </summary>
        <div class="appearance-fields">
          {range(
            t('Card width'),
            card.width,
            ranges.width,
            (value) => setCard('width', value),
            () => setCard('width', defaults.card.width),
            ' px',
          )}
          {range(
            t('Card padding'),
            card.padding,
            ranges.padding,
            (value) => setCard('padding', value),
            () => setCard('padding', defaults.card.padding),
            ' px',
          )}
          {color(
            t('Card color'),
            card.color,
            (value) => setCard('color', value),
            () => setCard('color', defaults.card.color),
          )}
          {range(
            t('Card opacity'),
            card.opacity,
            ranges.percent,
            (value) => setCard('opacity', value),
            () => setCard('opacity', defaults.card.opacity),
            '%',
          )}
          {range(
            t('Card radius'),
            card.radius,
            ranges.radius,
            (value) => setCard('radius', value),
            () => setCard('radius', defaults.card.radius),
            ' px',
          )}
          {range(
            t('Card backdrop blur'),
            card.blur,
            ranges.blur,
            (value) => setCard('blur', value),
            () => setCard('blur', defaults.card.blur),
            ' px',
          )}
          {range(
            t('Card border'),
            card.border,
            ranges.border,
            (value) => setCard('border', value),
            () => setCard('border', defaults.card.border),
            ' px',
          )}
          {color(
            t('Card border color'),
            card.borderColor,
            (value) => setCard('borderColor', value),
            () => setCard('borderColor', defaults.card.borderColor),
          )}
          <Choice
            label={t('Card shadow')}
            value={card.shadow}
            values={shadows}
            change={(value) => setCard('shadow', value)}
            reset={() => setCard('shadow', defaults.card.shadow)}
          />
          <Reset name={t('Card group')} onClick={() => resetGroup('card')} />
          <Choice
            label={t('Avatar position')}
            value={appearance.avatar.position}
            values={['above', 'start', 'end']}
            change={(value) => setAvatar('position', value)}
            reset={() => setAvatar('position', defaults.avatar.position)}
          />
          <Choice
            label={t('Avatar shape')}
            value={appearance.avatar.shape}
            values={avatarShapes}
            change={(value) => setAvatar('shape', value)}
            reset={() => setAvatar('shape', defaults.avatar.shape)}
          />
          {range(
            t('Avatar size'),
            appearance.avatar.size,
            ranges.avatarSize,
            (value) => setAvatar('size', value),
            () => setAvatar('size', defaults.avatar.size),
            ' px',
          )}
          {color(
            t('Accent color'),
            appearance.accent,
            (value) => update((current) => ({ ...current, accent: value })),
            () =>
              update((current) => ({ ...current, accent: defaults.accent })),
          )}
          <Reset
            name={t('Avatar group')}
            onClick={() => {
              resetGroup('avatar')
              update((current) => ({ ...current, accent: defaults.accent }))
            }}
          />
        </div>
      </details>
      <details class="appearance-group">
        <summary>
          {t('Link style')}
          <Icon name="down" />
        </summary>
        <div class="appearance-fields">
          <Choice
            label={t('Link style')}
            value={links.style}
            values={linkStyles}
            change={(value) => setLinks('style', value)}
            reset={() => setLinks('style', defaults.links.style)}
          />
          {color(
            t('Link color'),
            links.color,
            (value) => setLinks('color', value),
            () => setLinks('color', defaults.links.color),
          )}
          {color(
            t('Link text color'),
            links.text,
            (value) => setLinks('text', value),
            () => setLinks('text', defaults.links.text),
          )}
          {range(
            t('Link radius'),
            links.radius,
            ranges.radius,
            (value) => setLinks('radius', value),
            () => setLinks('radius', defaults.links.radius),
            ' px',
          )}
          {range(
            t('Link border'),
            links.border,
            ranges.border,
            (value) => setLinks('border', value),
            () => setLinks('border', defaults.links.border),
            ' px',
          )}
          {color(
            t('Link border color'),
            links.borderColor,
            (value) => setLinks('borderColor', value),
            () => setLinks('borderColor', defaults.links.borderColor),
          )}
          <Choice
            label={t('Link shadow')}
            value={links.shadow}
            values={shadows}
            change={(value) => setLinks('shadow', value)}
            reset={() => setLinks('shadow', defaults.links.shadow)}
          />
          {range(
            t('Link height'),
            links.height,
            ranges.linkHeight,
            (value) => setLinks('height', value),
            () => setLinks('height', defaults.links.height),
            ' px',
          )}
          {range(
            t('Link spacing'),
            links.gap,
            ranges.gap,
            (value) => setLinks('gap', value),
            () => setLinks('gap', defaults.links.gap),
            ' px',
          )}
          <Choice
            label={t('Link hover effect')}
            value={links.hover}
            values={hoverStyles}
            change={(value) => setLinks('hover', value)}
            reset={() => setLinks('hover', defaults.links.hover)}
          />
          <Reset name={t('Link group')} onClick={() => resetGroup('links')} />
        </div>
      </details>
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
            {t('Undo appearance change')}
          </button>
        )}
        <button
          type="button"
          class="button button-quiet"
          onClick={() => resetDialog.current?.showModal()}
        >
          {t('Reset appearance')}
        </button>
      </div>
      <dialog
        ref={appearanceDialog}
        class="settings-dialog"
        aria-labelledby="appearance-dialog-title"
        onClose={() => {
          setActiveDialog(null)
          opener.current?.focus()
        }}
      >
        {activeDialog && (
          <>
            <header class="settings-dialog-header">
              <h2 id="appearance-dialog-title">{t(dialogs[activeDialog])}</h2>
              <button
                type="button"
                class="button button-quiet"
                autoFocus
                onClick={() => appearanceDialog.current?.close()}
              >
                {t('Done')}
              </button>
            </header>
            <div class="settings-dialog-body">
              <div class="settings-dialog-controls">
                {controls[activeDialog]}
              </div>
              <div class="settings-dialog-preview">
                <div class="settings-preview-bar">
                  <span id="appearance-preview-title">
                    {t('Settings preview')}
                  </span>
                  {(activeDialog === 'overlay' ||
                    activeDialog === 'name' ||
                    activeDialog === 'motion') && (
                    <button
                      type="button"
                      class="appearance-reset"
                      onClick={() => setPreviewKey((key) => key + 1)}
                    >
                      {t('Replay preview')}
                    </button>
                  )}
                </div>
                {(activeDialog === 'click' || activeDialog === 'cursor') && (
                  <p class="hint">
                    {t(
                      activeDialog === 'click'
                        ? 'Click inside the preview to test the effect.'
                        : 'Move your pointer inside the preview to try the cursor and trail.',
                    )}
                  </p>
                )}
                <div
                  class="settings-profile-scroll profile-viewport"
                  role="region"
                  aria-labelledby="appearance-preview-title"
                  tabIndex={0}
                >
                  {renderPreview(previewKey)}
                </div>
              </div>
            </div>
          </>
        )}
      </dialog>
      <dialog
        ref={resetDialog}
        class="import-dialog"
        aria-labelledby="reset-title"
      >
        <h2 id="reset-title">{t('Reset appearance?')}</h2>
        <p>{t('Your profile will use the default Minimal preset.')}</p>
        <div class="dialog-actions">
          <button
            type="button"
            class="button button-outline"
            autoFocus
            onClick={() => resetDialog.current?.close()}
          >
            {t('Cancel')}
          </button>
          <button
            type="button"
            class="button button-primary"
            onClick={() => {
              applyPreset('minimal')
              resetDialog.current?.close()
            }}
          >
            {t('Reset to Minimal')}
          </button>
        </div>
      </dialog>
    </div>
  )
}
