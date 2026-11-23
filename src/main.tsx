import { render } from 'preact'
import '@fontsource-variable/manrope'
import avatarUrl from './assets/mira-park.png'
import { Editor } from './editor/Editor'
import { encodeAvatar } from './editor/files'
import { readDraft } from './editor/storage'
import { demoProfile } from './profile/demo'
import './editor/editor.css'
import './public/profile.css'

const root = document.getElementById('app')
if (!root) throw new Error('The Rvnce editor root is missing.')

const draft = readDraft()
let demoAvatar = null
if (!draft.doc) {
  render(
    <p class="loading-editor" role="status">
      Loading editor…
    </p>,
    root,
  )
  try {
    const response = await fetch(avatarUrl)
    if (response.ok) demoAvatar = await encodeAvatar(await response.blob())
  } catch {
    // The sample still works with a text avatar when the image is unavailable.
  }
}
render(
  <Editor
    initialDoc={draft.doc ?? demoProfile(demoAvatar)}
    initialStatus={draft.status}
  />,
  root,
)
