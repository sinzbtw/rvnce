import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { siteFiles } from '../src/export/site'
import { demoProfile } from '../src/profile/demo'

const root = fileURLToPath(new URL('../', import.meta.url))
const dev = process.argv.includes('--dev')
const output = join(root, dev ? '.cache/dev-public' : 'dist')
const font = join(root, 'node_modules', '@fontsource-variable', 'manrope')

const [avatar, css, latinFont, cyrillicFont, fontLicense] = await Promise.all([
  readFile(join(root, 'src/assets/mira-park.png')),
  readFile(join(root, 'src/public/profile.css'), 'utf8'),
  readFile(join(font, 'files/manrope-latin-wght-normal.woff2')),
  readFile(join(font, 'files/manrope-cyrillic-wght-normal.woff2')),
  readFile(join(font, 'LICENSE')),
])
const files = siteFiles(demoProfile(avatar.toString('base64')), {
  css,
  latinFont,
  cyrillicFont,
  fontLicense,
})

await Promise.all(
  Object.entries(files).map(async ([name, content]) => {
    const target = join(output, 'demo', name)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, content)
  }),
)
if (!dev) {
  await writeFile(join(output, '.nojekyll'), '')
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
