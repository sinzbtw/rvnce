import { renderToString } from 'preact-render-to-string'
import { h } from 'preact'
import {
  avatarBytes,
  faviconBytes,
  profileLanguage,
  type ProfileDocument,
} from '../profile/document'
import { backgroundFilename, decodeBase64 } from '../profile/media'
import { accessoryBytes } from '../profile/effects'
import { imageVariable, profileVariables } from '../public/appearance-css'
import { cursorArt } from '../public/cursor-art'
import { PublicProfile } from '../public/PublicProfile'

export function fontFiles(stylesheet: string): string[] {
  return Array.from(
    stylesheet.matchAll(/url\(\.\/files\/([a-z0-9-]+\.woff2)\)/gu),
    (match) => match[1]!,
  )
}

function fontPath(name: string) {
  return 'fonts/' + name.replace('-wght-normal.woff2', '.woff2')
}

interface SiteAssets {
  css: string
  fontCss: string
  fonts: Record<string, Uint8Array>
  fontLicense: Uint8Array
  lucideLicense: string
  fontAwesomeLicense: string
  motionScript?: string | undefined
  pointerScript?: string | undefined
  textScript?: string | undefined
  avatar?: Uint8Array | undefined
  favicon?: Uint8Array | undefined
}

export function siteFiles(
  doc: ProfileDocument,
  assets: SiteAssets,
): Record<string, string | Uint8Array> {
  const { appearance, profile, blocks } = doc
  const avatar =
    assets.avatar ?? (profile.avatar && avatarBytes(profile.avatar))
  const favicon =
    assets.favicon ??
    (doc.branding.favicon && faviconBytes(doc.branding.favicon))
  const media = appearance.background.media
  const filename = media && backgroundFilename(media)
  const motion = media && 'poster' in media
  const { cursor, click, trail } = appearance.effects
  const pointer = click.preset !== 'none' || trail !== 'none'
  const tabTitle = doc.branding.tabTitle
  const textMotion =
    appearance.effects.nameMotion.preset !== 'none' ||
    tabTitle.preset !== 'none'
  const cursorFile =
    cursor.preset === 'custom' && cursor.image
      ? accessoryBytes(cursor.image, 'cursor')
      : null
  const builtInCursor = cursorArt(cursor.preset)
  const cursorPath = cursorFile ? 'cursor.png' : builtInCursor?.path
  const iconFiles: Record<string, Uint8Array> = {}
  const iconUrls: [string, string][] = []
  const masks: string[] = []
  blocks
    .filter((block) => block.type === 'icon')
    .forEach((link, index) => {
      if (link.icon !== 'custom' || !link.image) return
      const path = 'icons/link-' + (index + 1) + '.png'
      const url = './' + path
      iconFiles[path] = accessoryBytes(link.image, 'icon')
      iconUrls.push([link.id, url])
      if (link.tint)
        masks.push(
          '[data-icon-slot="' +
            index +
            '"]{--icon-image:' +
            imageVariable(url) +
            '}',
        )
    })
  if (motion && !assets.motionScript)
    throw new Error('The background player could not be loaded.')
  if (pointer && !assets.pointerScript)
    throw new Error('The profile effects could not be loaded.')
  if (textMotion && !assets.textScript)
    throw new Error('The profile effects could not be loaded.')
  const csp = [
    "default-src 'none'",
    "style-src 'self'",
    "img-src 'self'",
    "font-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
  ]
  if (motion || pointer || textMotion) csp.push("script-src 'self'")
  if (media?.type === 'video/mp4') csp.push("media-src 'self'")

  const html = renderToString(
    <html lang={profileLanguage(profile.language) ?? 'en'}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta http-equiv="Content-Security-Policy" content={csp.join('; ')} />
        <meta name="referrer" content="no-referrer" />
        <meta name="description" content={profile.bio.trim()} />
        <title>{profile.name.trim()}</title>
        {favicon && <link rel="icon" type="image/png" href="./favicon.png" />}
        <link rel="stylesheet" href="./profile.css" />
        {motion && <script src="./background-motion.js" defer />}
        {pointer && <script src="./pointer-effects.js" defer />}
        {textMotion && <script src="./text-motion.js" defer />}
      </head>
      <body class="published-page" data-variant={appearance.variant}>
        {tabTitle.preset !== 'none' &&
          h('rvnce-tab-title', {
            hidden: true,
            'data-published': '',
            'data-motion': tabTitle.preset,
            'data-speed': tabTitle.speed,
          })}
        <main class="published-content profile-viewport">
          <PublicProfile
            doc={doc}
            assets={{
              avatarUrl: avatar ? './avatar.png' : null,
              backgroundUrl: filename ? './' + filename : undefined,
              posterUrl: motion ? './background-poster.jpg' : undefined,
              iconUrls: Object.fromEntries(iconUrls),
            }}
          />
        </main>
      </body>
    </html>,
  )
  const css = [
    assets.fontCss.replace(
      /url\(\.\/files\/([a-z0-9-]+\.woff2)\)/gu,
      (_, name: string) => 'url(./' + fontPath(name) + ')',
    ),
    '.published-page{' +
      Object.entries({
        ...profileVariables(appearance),
        ...(cursorPath
          ? { '--cursor-image': imageVariable('./' + cursorPath) }
          : {}),
      })
        .map(([key, value]) => key + ':' + value)
        .join(';') +
      '}',
    assets.css,
    ...masks,
  ].join('\n')

  return {
    'index.html': '<!doctype html>\n' + html,
    'profile.css': css,
    '.nojekyll': '',
    ...Object.fromEntries(
      Object.entries(assets.fonts).map(([name, bytes]) => [
        fontPath(name),
        bytes,
      ]),
    ),
    'fonts/OFL.txt': assets.fontLicense,
    'icons/Font-Awesome-LICENSE.txt': assets.fontAwesomeLicense,
    'icons/Lucide-LICENSE.txt': assets.lucideLicense,
    ...(avatar ? { 'avatar.png': avatar } : {}),
    ...(favicon ? { 'favicon.png': favicon } : {}),
    ...(cursorFile ? { 'cursor.png': cursorFile } : {}),
    ...(builtInCursor ? { [builtInCursor.path]: builtInCursor.svg } : {}),
    ...iconFiles,
    ...(pointer ? { 'pointer-effects.js': assets.pointerScript! } : {}),
    ...(textMotion ? { 'text-motion.js': assets.textScript! } : {}),
    ...(media && filename ? { [filename]: decodeBase64(media.data) } : {}),
    ...(motion
      ? {
          'background-poster.jpg': decodeBase64(media.poster),
          'background-motion.js': assets.motionScript!,
        }
      : {}),
  }
}
