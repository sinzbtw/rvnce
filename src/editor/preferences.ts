import { createContext } from 'preact'
import { useContext } from 'preact/hooks'
import { locales, messages, type Locale, type Message } from './messages'

export const languageNames: Record<Locale, string> = {
  en: 'English',
  ru: 'Русский',
  es: 'Español',
  'pt-BR': 'Português (Brasil)',
  fr: 'Français',
  de: 'Deutsch',
}

export const themes = ['system', 'light', 'dark'] as const
export type EditorTheme = (typeof themes)[number]

function preference(key: string) {
  try {
    return localStorage.getItem('rvnce.editor.' + key)
  } catch {
    return null
  }
}

export function savePreference(key: 'locale' | 'theme', value: string) {
  try {
    localStorage.setItem('rvnce.editor.' + key, value)
  } catch {
    // Preferences still apply while the editor is open.
  }
}

export function browserLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0]
    const locale = locales.find(
      (item) => item.toLowerCase().split('-')[0] === base,
    )
    if (locale) return locale
  }
  return 'en'
}

export function initialLocale(): Locale {
  const saved = preference('locale')
  return (
    locales.find((item) => item === saved) ??
    browserLocale(navigator.languages ?? [navigator.language])
  )
}

export function initialTheme(): EditorTheme {
  const saved = preference('theme')
  return themes.find((item) => item === saved) ?? 'system'
}

export function applyTheme(theme: EditorTheme) {
  document.documentElement.dataset.editorTheme = theme
}

let activeThemeTransition: ViewTransition | null = null
let themeChange = 0

export function transitionTheme(theme: EditorTheme) {
  const request = ++themeChange
  const root = document.documentElement
  const systemDark = matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = (value: string | undefined) =>
    value === 'system' ? systemDark : value === 'dark'
  const apply = () => {
    if (request === themeChange) applyTheme(theme)
  }

  activeThemeTransition?.skipTransition()
  if (
    !document.startViewTransition ||
    matchMedia('(prefers-reduced-motion: reduce)').matches ||
    isDark(root.dataset.editorTheme) === isDark(theme)
  ) {
    apply()
    return
  }

  root.classList.add('theme-switching')
  const transition = document.startViewTransition(apply)
  activeThemeTransition = transition
  const cleanup = () => {
    if (activeThemeTransition !== transition) return
    activeThemeTransition = null
    root.classList.remove('theme-switching')
  }
  void transition.ready.catch(() => {})
  void transition.finished.then(cleanup, cleanup)
}

type Values = Record<string, string | number>
export type Copy = (message: Message, values?: Values) => string

export function copyFor(locale: Locale): Copy {
  const index = locales.indexOf(locale) - 1
  return (message, values) => {
    const text = messages[message][index] ?? message
    return values
      ? text.replace(/\{([a-z]+)\}/gu, (token, name: string) =>
          Object.hasOwn(values, name) ? String(values[name]) : token,
        )
      : text
  }
}

export function applyLocale(locale: Locale) {
  document.documentElement.lang = locale
  document.title = copyFor(locale)('Rvnce — Profile editor')
}

export function errorCopy(
  t: Copy,
  error: unknown,
  fallback: Message = 'Something went wrong. Try again.',
) {
  const text = error instanceof Error ? error.message : ''
  if (Object.hasOwn(messages, text)) return t(text as Message)
  const size =
    /^Choose an image up to ([\d.]+) megapixels and (\d+) pixels per side\.$/u.exec(
      text,
    )
  if (size) {
    return t(
      'Choose an image up to {value} megapixels and {edge} pixels per side.',
      {
        value: size[1]!,
        edge: size[2]!,
      },
    )
  }
  return t(fallback)
}

export const CopyContext = createContext<Copy>(copyFor('en'))
export const useCopy = () => useContext(CopyContext)
