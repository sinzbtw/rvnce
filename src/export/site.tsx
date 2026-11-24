import { renderToString } from 'preact-render-to-string'
import {
  avatarBytes,
  faviconBytes,
  profileLanguage,
  type ProfileDocument,
} from '../profile/document'
import { backgroundFilename, decodeBase64 } from '../profile/media'
import { profileVariables } from '../public/appearance-css'
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
  motionScript?: string | undefined
  avatar?: Uint8Array | undefined
  favicon?: Uint8Array | undefined
}

export function siteFiles(
  doc: ProfileDocument,
  assets: SiteAssets,
): Record<string, string | Uint8Array> {
  const { appearance, profile } = doc
  const avatar =
    assets.avatar ?? (profile.avatar && avatarBytes(profile.avatar))
  const favicon =
    assets.favicon ??
    (doc.branding.favicon && faviconBytes(doc.branding.favicon))
  const media = appearance.background.media
  const filename = media && backgroundFilename(media)
  const motion = media && 'poster' in media
  if (motion && !assets.motionScript)
    throw new Error('The background player could not be loaded.')
  const csp = [
    "default-src 'none'",
    "style-src 'self'",
    "img-src 'self'",
    "font-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
  ]
  if (motion) csp.push("script-src 'self'")
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
      </head>
      <body class="published-page" data-variant={appearance.variant}>
        <main class="published-content profile-viewport">
          <PublicProfile
            doc={doc}
            assets={{
              avatarUrl: avatar ? './avatar.png' : null,
              backgroundUrl: filename ? './' + filename : undefined,
              posterUrl: motion ? './background-poster.jpg' : undefined,
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
      Object.entries(profileVariables(appearance))
        .map(([key, value]) => key + ':' + value)
        .join(';') +
      '}',
    assets.css,
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
    ...(avatar ? { 'avatar.png': avatar } : {}),
    ...(favicon ? { 'favicon.png': favicon } : {}),
    ...(media && filename ? { [filename]: decodeBase64(media.data) } : {}),
    ...(motion
      ? {
          'background-poster.jpg': decodeBase64(media.poster),
          'background-motion.js': assets.motionScript!,
        }
      : {}),
  }
}
