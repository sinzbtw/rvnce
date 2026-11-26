import { render } from 'preact'
import '@fontsource-variable/manrope'
import '@fontsource-variable/source-sans-3'
import '@fontsource-variable/source-serif-4'
import { Editor } from './editor/Editor'
import {
  applyLocale,
  applyTheme,
  copyFor,
  initialLocale,
  initialTheme,
} from './editor/preferences'
import { readDraft } from './editor/storage'
import { newProfile } from './profile/demo'
import './public/background-motion.js'
import './public/pointer-effects.js'
import './editor/editor.css'
import profileCss from './public/profile.css?raw'

const profileStyle = document.createElement('style')
profileStyle.textContent = profileCss
document.head.append(profileStyle)

const root = document.getElementById('app')
if (!root) throw new Error('The Rvnce editor root is missing.')

const locale = initialLocale()
const theme = initialTheme()
applyLocale(locale)
applyTheme(theme)

render(
  <p class="startup-status" role="status">
    {copyFor(locale)('Loading your draft…')}
  </p>,
  root,
)
const initialDraft = await readDraft()

render(
  <Editor
    initialDraft={initialDraft}
    sample={newProfile()}
    initialLocale={locale}
    initialTheme={theme}
  />,
  root,
)
