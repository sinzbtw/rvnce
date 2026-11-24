import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { fontFiles, siteFiles } from '../src/export/site'
import { demoProfile, examples } from '../src/profile/demo'
import { fontNames, type FontName } from '../src/profile/appearance'

const root = fileURLToPath(new URL('../', import.meta.url))
const dev = process.argv.includes('--dev')
const output = join(root, dev ? '.cache/dev-public' : 'dist')

const [avatar, css] = await Promise.all([
  readFile(join(root, 'src/assets/mira-park.png')),
  readFile(join(root, 'src/public/profile.css'), 'utf8'),
])

async function loadFont(family: FontName) {
  const font = join(root, 'node_modules', '@fontsource-variable', family)
  const [fontCss, fontLicense] = await Promise.all([
    readFile(join(font, 'index.css'), 'utf8'),
    readFile(join(font, 'LICENSE')),
  ])
  const fonts = await Promise.all(
    fontFiles(fontCss).map(
      async (name) =>
        [name, await readFile(join(font, 'files', name))] as const,
    ),
  )
  return { fontCss, fontLicense, fonts: Object.fromEntries(fonts) }
}

const fonts = new Map(
  await Promise.all(
    fontNames.map(async (family) => [family, await loadFont(family)] as const),
  ),
)

await Promise.all(
  examples.map(async (example) => {
    const graphic = example.preset === 'graphic'
    const doc = demoProfile(graphic ? avatar.toString('base64') : null, example)
    const font = fonts.get(doc.appearance.typography.font)!
    const files = siteFiles(doc, { css, ...font })
    await Promise.all(
      Object.entries(files).map(async ([name, content]) => {
        const target = join(output, 'demo', graphic ? '' : example.preset, name)
        await mkdir(dirname(target), { recursive: true })
        await writeFile(target, content)
      }),
    )
  }),
)

if (!dev) {
  await writeFile(join(output, '.nojekyll'), '')
  await Promise.all(
    fontNames.map((family) =>
      writeFile(
        join(output, 'assets', family + '-OFL.txt'),
        fonts.get(family)!.fontLicense,
      ),
    ),
  )
  const bundles = (await readdir(join(output, 'assets'))).filter((name) =>
    /\.(js|css)$/u.test(name),
  )
  const sizes = await Promise.all(
    bundles.map(
      async (name) =>
        gzipSync(await readFile(join(output, 'assets', name))).length,
    ),
  )
  const total = sizes.reduce((sum, size) => sum + size, 0)
  if (total > 100 * 1024) {
    throw new Error('Editor JS and CSS exceed the 100 KiB compressed budget.')
  }
  console.log('Editor JS and CSS: ' + (total / 1024).toFixed(1) + ' KiB gzip.')
}
