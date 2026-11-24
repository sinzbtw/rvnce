import { render } from 'preact'
import '@fontsource-variable/manrope'
import '@fontsource-variable/source-sans-3'
import '@fontsource-variable/source-serif-4'
import { Editor } from './editor/Editor'
import { readDraft } from './editor/storage'
import { newProfile } from './profile/demo'
import './public/background-motion.js'
import './editor/editor.css'
import './public/profile.css'

const root = document.getElementById('app')
if (!root) throw new Error('The Rvnce editor root is missing.')

render(
  <p class="startup-status" role="status">
    Loading your draft…
  </p>,
  root,
)
const initialDraft = await readDraft()

render(<Editor initialDraft={initialDraft} sample={newProfile()} />, root)
