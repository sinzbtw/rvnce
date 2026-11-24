import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { strFromU8, unzipSync } from 'fflate'
import type { ProfileDocument, ThemeDocument } from '../src/profile/document'

const photo = new URL('../src/assets/mira-park.png', import.meta.url)
const files = {
  gif: new URL('./fixtures/background.gif', import.meta.url),
  mp4: new URL('./fixtures/background.mp4', import.meta.url),
}

async function download(page: Page, name: string) {
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name, exact: false }).click()
  return readFile((await (await pending).path())!)
}

async function serveArchive(archive: ReturnType<typeof unzipSync>) {
  const types: Record<string, string> = {
    html: 'text/html; charset=utf-8',
    js: 'text/javascript',
    css: 'text/css',
    woff2: 'font/woff2',
    gif: 'image/gif',
    jpg: 'image/jpeg',
    mp4: 'video/mp4',
  }
  const prefix = '/repo/profiles/test/'
  const server = createServer((request, response) => {
    const path = request.url?.startsWith(prefix)
      ? request.url.slice(prefix.length) || 'index.html'
      : ''
    const data = archive[path]
    if (!data) {
      response.writeHead(404).end()
      return
    }
    const contentType =
      types[path.split('.').at(-1)!] ?? 'application/octet-stream'
    const range = /^bytes=(\d+)-(\d*)$/u.exec(request.headers.range ?? '')
    if (range) {
      const start = Number(range[1])
      const end = Math.min(
        range[2] ? Number(range[2]) : data.length - 1,
        data.length - 1,
      )
      response
        .writeHead(206, {
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Content-Range': 'bytes ' + start + '-' + end + '/' + data.length,
          'Content-Length': end - start + 1,
        })
        .end(data.subarray(start, end + 1))
    } else
      response
        .writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': data.length,
        })
        .end(data)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('The archive host did not start.')
  return {
    url: 'http://127.0.0.1:' + address.port + prefix,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

test('keeps branding independent of portable themes and restores the full draft', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Show preview' }).click()
  const preview = page.locator('.public-profile')
  const credit = preview.getByText('Made with Rvnce', { exact: true })
  await expect(preview).toHaveAttribute('data-preset', 'minimal')
  await expect(credit).toBeVisible()
  await page.getByLabel('Display name').fill('Ocean Studio')
  await page.getByLabel('Show Made with Rvnce').uncheck()
  await expect(credit).toHaveCount(0)
  await page.getByRole('button', { name: 'Appearance' }).click()
  await page.getByRole('button', { name: 'Glass', exact: true }).click()
  await expect(preview).toHaveAttribute('data-preset', 'glass')
  await expect(credit).toHaveCount(0)
  const upload = page.locator('input[aria-label="Background file"]')
  await upload.setInputFiles({
    name: 'background.png',
    mimeType: 'image/png',
    buffer: await readFile(photo),
  })
  await expect(preview.locator('.profile-backdrop img')).toBeVisible()
  await expect(page.getByText('Saved locally')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Show preview' }).click()
  await expect(preview.locator('.profile-backdrop img')).toBeVisible()
  await expect(page.getByLabel('Show Made with Rvnce')).not.toBeChecked()
  await page.getByRole('button', { name: 'Appearance' }).click()

  const theme = await download(page, 'Export theme')
  const parsedTheme = JSON.parse(theme.toString()) as ThemeDocument
  expect(parsedTheme.appearance.background.media?.type).toBe('image/png')
  expect(parsedTheme).not.toHaveProperty('branding')

  await upload.setInputFiles({
    name: 'broken.png',
    mimeType: 'image/png',
    buffer: Buffer.from('broken'),
  })
  await expect(page.getByRole('alert')).toContainText('Choose a readable')
  await expect(preview.locator('.profile-backdrop img')).toBeVisible()
  await page.getByRole('button', { name: 'Remove background file' }).click()
  await expect(preview.locator('.profile-backdrop img')).toHaveCount(0)
  await page.locator('input[aria-label="Theme file"]').setInputFiles({
    name: 'theme.json',
    mimeType: 'application/json',
    buffer: theme,
  })
  await expect(preview.locator('.profile-backdrop img')).toBeVisible()
  await page
    .getByRole('button', { name: 'Reset appearance', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Reset to Minimal', exact: true })
    .click()
  await expect(preview).toHaveAttribute('data-preset', 'minimal')
  await page.getByRole('button', { name: 'Undo appearance change' }).click()
  await expect(preview).toHaveAttribute('data-preset', 'glass')
  await expect(credit).toHaveCount(0)

  const exported = unzipSync(await download(page, 'Download site'))
  expect(exported['background.png']).toBeDefined()
  expect(strFromU8(exported['index.html']!)).not.toContain('Made with Rvnce')
  expect(exported['background-motion.js']).toBeUndefined()

  const profile = await download(page, 'Export JSON')
  const parsedProfile = JSON.parse(profile.toString()) as ProfileDocument
  expect(parsedProfile.appearance).toEqual(parsedTheme.appearance)
  expect(parsedProfile.branding.showMadeWithRvnce).toBe(false)
  await page.getByRole('button', { name: 'Profile', exact: true }).click()
  await page.getByLabel('Show Made with Rvnce').check()
  await expect(credit).toBeVisible()
  await page.locator('input[accept=".json,application/json"]').setInputFiles({
    name: 'profile.json',
    mimeType: 'application/json',
    buffer: profile,
  })
  await page.getByRole('button', { name: 'Replace profile' }).click()
  await expect(credit).toHaveCount(0)
  await expect(page.getByLabel('Display name')).toHaveValue('Ocean Studio')
})

for (const extension of ['gif', 'mp4'] as const) {
  test(
    'exports ' +
      extension +
      ' motion and a poster with an accessible playback control',
    async ({ page, browser }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/')
      await page.getByRole('button', { name: 'Show preview' }).click()
      await page.getByLabel('Display name').fill('Signal Garden')
      await page.getByRole('button', { name: 'Appearance' }).click()
      const original = await readFile(files[extension])
      const mimeType = extension === 'gif' ? 'image/gif' : 'video/mp4'
      const codec = await page.evaluate(() =>
        document
          .createElement('video')
          .canPlayType('video/mp4; codecs="avc1.42E01E"'),
      )
      const input = page.locator('input[aria-label="Background file"]')
      await input.setInputFiles({
        name: 'background.' + extension,
        mimeType,
        buffer: original,
      })
      const poster = page.locator('.background-poster')
      const manualPoster = page.getByRole('button', {
        name: 'Upload video poster',
      })
      await expect(poster.or(manualPoster)).toBeVisible()
      const posterOnlyPreview = await manualPoster.isVisible()
      if (posterOnlyPreview) {
        expect(extension).toBe('mp4')
        await page
          .locator('input[aria-label="Video poster file"]')
          .setInputFiles({
            name: 'poster.png',
            mimeType: 'image/png',
            buffer: await readFile(photo),
          })
      }
      await expect(poster).toBeVisible()
      const motion = page.locator('.background-moving')
      if (extension === 'gif') {
        await expect(motion).toHaveAttribute(
          'src',
          (await poster.getAttribute('src'))!,
        )
      } else {
        await expect(motion).not.toHaveAttribute('src', /.+/u)
      }
      if (!posterOnlyPreview) {
        await page.getByRole('button', { name: 'Play background' }).click()
        await expect(page.locator('rvnce-motion')).toHaveAttribute(
          'data-playing',
          '',
        )
        await page.getByRole('button', { name: 'Stop background' }).click()
        await expect(page.locator('rvnce-motion')).not.toHaveAttribute(
          'data-playing',
          '',
        )
      }
      const archive = unzipSync(await download(page, 'Download site'))
      expect(Buffer.from(archive['background.' + extension]!)).toEqual(original)
      expect(archive['background-poster.jpg']).toBeDefined()
      const html = strFromU8(archive['index.html']!)
      expect(html).toContain('./background-motion.js')
      expect(html).toContain('./background.' + extension)
      expect(html).not.toContain('localStorage')
      const host = await serveArchive(archive)
      const scriptless = await browser.newContext({ javaScriptEnabled: false })
      const scripted = await browser.newContext()
      try {
        const staticPage = await scriptless.newPage()
        await staticPage.goto(host.url)
        await expect(
          staticPage.getByRole('heading', { name: 'Signal Garden' }),
        ).toBeVisible()
        await expect(staticPage.locator('.background-poster')).toHaveJSProperty(
          'complete',
          true,
        )
        await expect(
          staticPage.getByRole('button', { name: 'Play background' }),
        ).toBeHidden()
        await expect(
          staticPage.getByRole('link', { name: 'Made with Rvnce' }),
        ).toHaveAttribute('href', 'https://sinzbtw.github.io/rvnce/')

        if (extension === 'mp4' && !codec) return
        const animated = await scripted.newPage()
        if (extension === 'mp4') {
          await animated.addInitScript(() => {
            const play = HTMLMediaElement.prototype.play
            let first = true
            HTMLMediaElement.prototype.play = function () {
              if (!first) return play.call(this)
              first = false
              return Promise.reject(
                new DOMException('Autoplay blocked', 'NotAllowedError'),
              )
            }
          })
        }
        await animated.goto(host.url)
        if (extension === 'mp4') {
          await expect(
            animated.getByRole('button', { name: 'Play background' }),
          ).toBeVisible()
          await animated
            .getByRole('button', { name: 'Play background' })
            .click()
        }
        await expect(animated.locator('rvnce-motion')).toHaveAttribute(
          'data-playing',
          '',
        )
        await animated.getByRole('button', { name: 'Stop background' }).click()
        await expect(animated.locator('rvnce-motion')).not.toHaveAttribute(
          'data-playing',
          '',
        )
      } finally {
        await Promise.all([scriptless.close(), scripted.close()])
        await host.close()
      }
    },
  )
}
