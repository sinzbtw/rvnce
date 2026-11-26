import manropeCss from '@fontsource-variable/manrope/index.css?raw'
import interCss from '@fontsource-variable/inter/index.css?raw'
import oswaldCss from '@fontsource-variable/oswald/index.css?raw'
import monoCss from '@fontsource-variable/roboto-mono/index.css?raw'
import sansCss from '@fontsource-variable/source-sans-3/index.css?raw'
import serifCss from '@fontsource-variable/source-serif-4/index.css?raw'
import { fontFilePattern, fontNames, type FontName } from '../profile/fonts'

const fontUrls = import.meta.glob<string>(
  '/node_modules/@fontsource-variable/{manrope,inter,oswald,roboto-mono,source-sans-3,source-serif-4}/files/*-wght-normal.woff2',
  { import: 'default', query: '?url&no-inline', eager: true },
)
export const bundledFontCss: Record<FontName, string> = {
  manrope: manropeCss,
  inter: interCss,
  oswald: oswaldCss,
  'roboto-mono': monoCss,
  'source-sans-3': sansCss,
  'source-serif-4': serifCss,
}

export function bundledFontUrl(family: FontName, file: string) {
  return fontUrls[
    '/node_modules/@fontsource-variable/' + family + '/files/' + file
  ]
}

export function previewFontStyles() {
  return fontNames
    .map((family) =>
      bundledFontCss[family].replace(fontFilePattern, (_, file: string) => {
        const url = bundledFontUrl(family, file)
        return url
          ? 'url(' + JSON.stringify(url) + ')'
          : 'local("Rvnce missing font")'
      }),
    )
    .join('\n')
}
