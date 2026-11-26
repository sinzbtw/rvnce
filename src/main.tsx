import { render } from 'preact'
import { previewFontStyles } from './editor/bundled-fonts'
import { Editor } from './editor/Editor'
import {
  applyLocale,
  applyTheme,
  copyFor,
  initialLocale,
  initialTheme,
} from './editor/preferences'
import { readDraft } from './editor/storage'
import { runtimeAssets } from './editor/runtime-assets'
import { newProfile } from './profile/demo'
import './editor/editor.css'
import profileCss from './public/profile.css?raw'

const profileStyle = document.createElement('style')
profileStyle.textContent = previewFontStyles() + '\n' + profileCss
document.head.append(profileStyle)
for (const url of Object.values(runtimeAssets)) {
  const script = document.createElement('script')
  script.src = url
  document.head.append(script)
}

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
