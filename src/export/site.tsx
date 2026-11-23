import { renderToString } from 'preact-render-to-string'
import { avatarBytes, type ProfileDocument } from '../profile/document'
import { accentInk } from '../public/colors'
import { PublicProfile } from '../public/PublicProfile'

const latin =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
const cyrillic = 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116'

export function fontRules(latinUrl: string, cyrillicUrl: string): string {
  const font = (url: string, range: string) =>
    '@font-face{font-family:"Manrope Variable";font-style:normal;font-weight:200 800;font-display:swap;src:url("' +
    url +
    '") format("woff2");unicode-range:' +
    range +
    '}'
  return font(latinUrl, latin) + '\n' + font(cyrillicUrl, cyrillic)
}

interface SiteAssets {
  css: string
  latinFont: Uint8Array
  cyrillicFont: Uint8Array
  fontLicense: Uint8Array
}

export function siteFiles(
  doc: ProfileDocument,
  assets: SiteAssets,
): Record<string, string | Uint8Array> {
  const { accent } = doc.appearance
  const avatar = doc.profile.avatar && avatarBytes(doc.profile.avatar)
  const html = renderToString(
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta
          http-equiv="Content-Security-Policy"
          content="default-src 'none'; style-src 'self'; img-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'"
        />
        <meta name="referrer" content="no-referrer" />
        <meta name="description" content={doc.profile.bio.trim()} />
        <title>{doc.profile.name.trim()}</title>
        <link rel="stylesheet" href="./profile.css" />
      </head>
      <body class="published-page" data-variant={doc.appearance.variant}>
        <main class="published-content">
          <PublicProfile doc={doc} avatarUrl={avatar ? './avatar.png' : null} />
        </main>
      </body>
    </html>,
  )
  const css = [
    fontRules('./fonts/manrope-latin.woff2', './fonts/manrope-cyrillic.woff2'),
    '.published-page{margin:0;background:#eae5fc}.published-page[data-variant="dark"]{background:#221c35}',
    '.published-content{max-width:640px;margin:0 auto;padding-block:clamp(18px,9vh,100px)}',
    '.public-profile{--accent:' +
      accent +
      ';--accent-ink:' +
      accentInk(accent) +
      '}',
    assets.css,
  ].join('\n')

  return {
    'index.html': '<!doctype html>\n' + html,
    'profile.css': css,
    '.nojekyll': '',
    'fonts/manrope-latin.woff2': assets.latinFont,
    'fonts/manrope-cyrillic.woff2': assets.cyrillicFont,
    'fonts/OFL.txt': assets.fontLicense,
    ...(avatar ? { 'avatar.png': avatar } : {}),
  }
}
