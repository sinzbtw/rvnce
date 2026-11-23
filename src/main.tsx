import { render } from 'preact'
import '@fontsource-variable/manrope'
import avatarUrl from './assets/mira-park.png'
import { Editor } from './editor/Editor'
import { readDraft } from './editor/storage'
import { demoProfile } from './profile/demo'
import './editor/editor.css'
import './public/profile.css'

const root = document.getElementById('app')
if (!root) throw new Error('The Rvnce editor root is missing.')

render(
  <Editor
    initialDraft={readDraft()}
    sample={demoProfile(null)}
    sampleAvatarUrl={avatarUrl}
  />,
  root,
)
