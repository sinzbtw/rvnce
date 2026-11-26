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
    png: 'image/png',
    svg: 'image/svg+xml',
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
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve())
        server.closeAllConnections()
      }),
  }
}

test('effect dialogs preview immediately, restore focus, and match the static export', async ({
  page,
  browser,
}) => {
  await page.goto('/')
  await page.getByLabel('Display name').fill('Mira Park')
  await page.getByRole('button', { name: 'Appearance' }).click()

  const overlayButton = page.getByRole('button', { name: 'Page overlay' })
  await overlayButton.focus()
  await page.keyboard.press('Enter')
  const overlay = page.getByRole('dialog', { name: 'Page overlay' })
  await expect(overlay.getByRole('button', { name: 'Done' })).toBeFocused()
  await overlay
    .getByLabel('Overlay preset', { exact: true })
    .selectOption('snow')
  await overlay.getByLabel('Overlay color', { exact: true }).fill('#55ccaa')
  await overlay.getByLabel('Overlay intensity', { exact: true }).fill('80')
  await expect(overlay.locator('.profile-overlay')).toHaveAttribute(
    'data-overlay',
    'snow',
  )
  await expect(overlay.locator('.profile-overlay')).toHaveCSS('opacity', '0.2')
  await page.keyboard.press('Escape')
  await expect(overlayButton).toBeFocused()

  await page.getByRole('button', { name: 'Display name effects' }).click()
  const name = page.getByRole('dialog', { name: 'Display name effects' })
  await name.getByLabel('Sparkles around the name').check()
  await name.getByLabel('Sparkle color', { exact: true }).fill('#8844aa')
  await name.getByLabel('Style the name text').check()
  await name
    .getByLabel('Name effect preset', { exact: true })
    .selectOption('gradient')
  await expect(name.locator('.profile-name-text')).toHaveAttribute(
    'data-name-effect',
    'gradient',
  )
  await expect(name.locator('.profile-name-sparkles')).toHaveCSS(
    'color',
    'rgb(136, 68, 170)',
  )
  await name.getByLabel('Sparkles around the name').uncheck()
  await expect(name.locator('.profile-name-sparkles')).toHaveCount(0)
  await expect(name.locator('.profile-name-text')).toHaveAttribute(
    'data-name-effect',
    'gradient',
  )
  await name.getByLabel('Sparkles around the name').check()
  await expect(name.getByLabel('Sparkle color', { exact: true })).toHaveValue(
    '#8844aa',
  )
  await name.getByRole('button', { name: 'Done' }).click()

  await page.getByRole('button', { name: 'Click effects' }).click()
  const click = page.getByRole('dialog', { name: 'Click effects' })
  await click
    .getByLabel('Click effect preset', { exact: true })
    .selectOption('ripple')
  const clickPreview = click.locator('.public-profile')
  await clickPreview.click({ position: { x: 70, y: 75 } })
  await expect(click.locator('[data-effect="ripple"]')).toHaveCSS(
    'left',
    /^(?:69|70)(?:\.\d+)?px$/,
  )
  await expect(click.locator('[data-effect="ripple"]')).toHaveCount(0)
  await click.getByRole('button', { name: 'Done' }).click()

  await page.getByRole('button', { name: 'Cursor and trail' }).click()
  const cursor = page.getByRole('dialog', { name: 'Cursor and trail' })
  const cursorPreview = cursor.locator('.public-profile')
  await cursor
    .getByLabel('Cursor preset', { exact: true })
    .selectOption('crosshair')
  await expect(cursorPreview).toHaveCSS('cursor', 'crosshair')
  await cursor.locator('input[type=file]').setInputFiles({
    name: 'cursor.png',
    mimeType: 'image/png',
    buffer: await readFile(photo),
  })
  await expect(cursorPreview).toHaveAttribute('data-cursor', 'custom')
  await cursor.getByLabel('Cursor trail', { exact: true }).selectOption('ghost')
  await cursorPreview.hover({ position: { x: 55, y: 60 } })
  await expect(cursor.locator('[data-effect="ghost"]').first()).toBeVisible()
  await cursor.getByRole('button', { name: 'Done' }).click()

  const archive = unzipSync(await download(page, 'Download site'))
  expect(archive['cursor.png']).toBeDefined()
  expect(strFromU8(archive['profile.css']!)).toContain('url("./cursor.png")')
  const host = await serveArchive(archive)
  const context = await browser.newContext()
  try {
    const published = await context.newPage()
    await published.goto(host.url)
    await expect(published.locator('.profile-overlay')).toHaveAttribute(
      'data-overlay',
      'snow',
    )
    await expect(published.locator('.profile-name-sparkles')).toHaveCSS(
      'color',
      'rgb(136, 68, 170)',
    )
    await expect(published.locator('.public-profile')).toHaveCSS(
      'cursor',
      /cursor\.png/,
    )
    await published
      .locator('.public-profile')
      .click({ position: { x: 54, y: 65 } })
    await expect(published.locator('[data-effect="ripple"]')).toHaveCSS(
      'top',
      /^(?:64|65)(?:\.\d+)?px$/,
    )
    await published.emulateMedia({ reducedMotion: 'reduce' })
    await expect(published.locator('.profile-name-text')).not.toHaveCSS(
      'color',
      'rgba(0, 0, 0, 0)',
    )
    await expect(published.locator('.profile-overlay i').first()).toHaveCSS(
      'animation-name',
      'none',
    )
    await published
      .locator('.public-profile')
      .click({ position: { x: 55, y: 65 } })
    await expect(published.locator('.profile-pointer-mark')).toHaveCount(0)
  } finally {
    await context.close()
    await host.close()
  }

  await page.setViewportSize({ width: 390, height: 700 })
  await page.getByRole('button', { name: 'Page overlay' }).click()
  await expect(
    overlay.getByRole('region', { name: 'Settings preview' }),
  ).toBeVisible()
  await expect(
    overlay.getByLabel('Overlay preset', { exact: true }),
  ).toBeVisible()
  expect(
    await overlay.evaluate((dialog) => dialog.scrollWidth),
  ).toBeLessThanOrEqual(390)
})

for (const surface of ['light', 'dark', 'media']) {
  test(
    'new page overlays preview and export on ' + surface,
    async ({ page }) => {
      await page.goto('/')
      await page.getByLabel('Display name').fill('Mira Park')
      await page.getByRole('button', { name: 'Appearance' }).click()
      const trigger = page.getByRole('button', { name: 'Page overlay' })
      const dialog = page.getByRole('dialog', { name: 'Page overlay' })
      test.setTimeout(65_000)
      if (surface === 'dark')
        await page.getByRole('radio', { name: 'Dark' }).check()
      if (surface === 'media') {
        await page
          .getByRole('button', { name: 'Background', exact: true })
          .click()
        const settings = page.getByRole('dialog', { name: 'Background' })
        await settings
          .getByLabel('Background file', { exact: true })
          .setInputFiles({
            name: 'backdrop.png',
            mimeType: 'image/png',
            buffer: await readFile(photo),
          })
        await expect(settings.locator('.profile-backdrop img')).toBeVisible()
        await settings.getByRole('button', { name: 'Done' }).click()
      }
      for (const [preset, animation, selector] of [
        ['glitch', 'glitch-band', 'span'],
        ['matrix', 'matrix-fall', '.matrix-stream:not([hidden])'],
        ['dust', 'overlay-float', 'i'],
        ['embers', 'ember-rise', 'i'],
      ] as const) {
        await trigger.click()
        await dialog
          .getByLabel('Overlay preset', { exact: true })
          .selectOption(preset)
        const layer = dialog.locator('.profile-overlay')
        await expect(layer).toHaveCSS('pointer-events', 'none')
        await expect(layer.locator(selector).first()).toHaveCSS(
          'animation-name',
          animation,
        )
        if (preset === 'matrix') {
          await dialog.getByLabel('Rain density', { exact: true }).fill('100')
          await expect(layer.locator(selector)).toHaveCount(18)
        }
        await dialog.getByRole('button', { name: 'Done' }).click()
        const host = await serveArchive(
          unzipSync(await download(page, 'Download site')),
        )
        const exported = await page.context().newPage()
        try {
          await exported.goto(host.url)
          const marks = exported.locator('.profile-overlay').locator(selector)
          await expect(marks.first()).toHaveCSS('animation-name', animation)
          await exported.emulateMedia({ reducedMotion: 'reduce' })
          await expect(marks.first()).toHaveCSS('animation-name', 'none')
        } finally {
          await exported.close()
          await host.close()
        }
      }
    },
  )
}

for (const [preset, keyframe] of [
  ['snow', 'overlay-drift'],
  ['particles', 'overlay-float'],
] as const) {
  test(
    preset + ' and name sparkles keep playing after 30 seconds',
    async ({ page }) => {
      test.setTimeout(60_000)
      await page.goto('/')
      await page.getByLabel('Display name').fill('Mira Park')
      await page.getByRole('button', { name: 'Appearance' }).click()
      await page.getByRole('button', { name: 'Page overlay' }).click()
      const overlay = page.getByRole('dialog', { name: 'Page overlay' })
      await overlay
        .getByLabel('Overlay preset', { exact: true })
        .selectOption(preset)
      await overlay.getByRole('button', { name: 'Done' }).click()
      await page.getByRole('button', { name: 'Display name effects' }).click()
      const name = page.getByRole('dialog', { name: 'Display name effects' })
      await name.getByLabel('Sparkles around the name').check()
      await name.getByLabel('Style the name text').check()
      await name
        .getByLabel('Name effect preset', { exact: true })
        .selectOption('gradient')
      await name.getByRole('button', { name: 'Done' }).click()
      const host = await serveArchive(
        unzipSync(await download(page, 'Download site')),
      )
      const published = await page.context().newPage()
      try {
        await published.goto(host.url)
        await page.getByRole('button', { name: 'Page overlay' }).click()
        const motion = async (profile: ReturnType<Page['locator']>) =>
          profile.evaluate((node) =>
            node
              .getAnimations({ subtree: true })
              .filter(
                (animation): animation is CSSAnimation =>
                  animation instanceof CSSAnimation,
              )
              .map((animation) => ({
                name: animation.animationName,
                time: Number(animation.currentTime),
                state: animation.playState,
              })),
          )
        const previewProfile = overlay.locator('.public-profile')
        const exportedProfile = published.locator('.public-profile')
        const start = await Promise.all([
          motion(previewProfile),
          motion(exportedProfile),
        ])
        await new Promise<void>((resolve) => setTimeout(resolve, 30_100))
        const end = await Promise.all([
          motion(previewProfile),
          motion(exportedProfile),
        ])
        for (const [index, animations] of end.entries()) {
          for (const animation of [
            keyframe,
            'sparkle-glimmer',
            'name-gradient',
          ]) {
            const initial = start[index]?.find(({ name }) => name === animation)
            const later = animations.find(({ name }) => name === animation)
            expect(later?.state).toBe('running')
            expect((later?.time ?? 0) - (initial?.time ?? 0)).toBeGreaterThan(
              29_000,
            )
          }
        }
      } finally {
        await published.close()
        await host.close()
      }
    },
  )
}

test('ships the selected cursor with its hotspot and keeps link affordances', async ({
  page,
  browser,
}) => {
  await page.goto('/')
  await page.getByLabel('Display name').fill('Signal Garden')
  await page.getByRole('button', { name: 'Appearance' }).click()
  await page.getByRole('button', { name: 'Cursor and trail' }).click()
  const settings = page.getByRole('dialog', { name: 'Cursor and trail' })
  for (const [preset, hotspot] of [
    ['pixel', '3 2'],
    ['neon', '3 3'],
    ['reticle', '12 12'],
  ]) {
    await settings
      .getByLabel('Cursor preset', { exact: true })
      .selectOption(preset!)
    await expect(settings.locator('.public-profile')).toHaveCSS(
      'cursor',
      new RegExp(hotspot + ', auto'),
    )
  }
  await settings
    .getByLabel('Cursor trail', { exact: true })
    .selectOption('sparkles')
  const sample = settings.locator('.public-profile')
  await sample.hover({ position: { x: 25, y: 25 } })
  const bounds = (await sample.boundingBox())!
  await page.mouse.move(bounds.x + 180, bounds.y + 35)
  await expect(
    settings.locator('[data-effect="trail-sparkles"]').first(),
  ).toBeVisible()
  await page.mouse.move(0, 0)
  await expect(settings.locator('[data-effect="trail-sparkles"]')).toHaveCount(
    0,
  )
  await settings.getByRole('button', { name: 'Done' }).click()
  const archive = unzipSync(await download(page, 'Download site'))
  expect(archive['cursors/reticle.svg']).toBeDefined()
  expect(archive['cursors/pixel.svg']).toBeUndefined()
  const host = await serveArchive(archive)
  const context = await browser.newContext({ deviceScaleFactor: 2 })
  try {
    const published = await context.newPage()
    await published.goto(host.url)
    await expect(published.locator('.public-profile')).toHaveCSS(
      'cursor',
      /\/cursors\/reticle\.svg"\) 12 12, auto/,
    )
    await expect(
      published.getByRole('heading', { name: 'Signal Garden' }),
    ).toHaveCSS('cursor', 'text')
    await expect(
      published.getByRole('link', { name: 'Made with Rvnce' }),
    ).toHaveCSS('cursor', 'pointer')
    await published.emulateMedia({ reducedMotion: 'reduce' })
    await published.mouse.move(30, 30)
    await expect(published.locator('.profile-pointer-mark')).toHaveCount(0)
  } finally {
    await context.close()
    await host.close()
  }
})

test('fits the settings preview to short profiles and scrolls on phones', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByLabel('Display name').fill('Mira Park')
  await page
    .getByLabel('Bio')
    .fill(
      'Independent designer making posters, type, and other things destined for a wall.',
    )
  await page.getByRole('button', { name: 'Appearance', exact: true }).click()
  await page.getByRole('button', { name: 'Background', exact: true }).click()
  await page
    .getByLabel('Background type', { exact: true })
    .selectOption('radial')
  const frame = page.getByRole('region', { name: 'Settings preview' })
  await expect(frame.locator('.public-profile h1')).toHaveText('Mira Park')
  expect(
    await frame.evaluate(
      (el) => el.clientHeight - el.firstElementChild!.clientHeight,
    ),
  ).toBe(0)

  await page.setViewportSize({ width: 390, height: 700 })
  await frame.evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  await expect
    .poll(() => frame.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0)
})

test('orders button and icon links independently and exports accessible social icons', async ({
  page,
  browser,
  browserName,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Show preview' }).click()
  await page.getByLabel('Display name').fill('Mira Park')
  await page.getByRole('button', { name: 'Links' }).click()
  async function add(kind: 'button' | 'icon', label: string, url: string) {
    await page
      .getByRole('button', {
        name: kind === 'icon' ? 'Add icon link' : 'Add link',
        exact: true,
      })
      .click()
    const group = page
      .getByRole('group', {
        name: kind === 'icon' ? /^Icon link \d/ : /^Link \d/,
      })
      .last()
    await group.getByLabel('Label').fill(label)
    await group.getByLabel('URL').fill(url)
    return group
  }
  await add('button', 'Portfolio', 'https://example.com/portfolio')
  const github = await add(
    'icon',
    'GitHub projects',
    'https://github.com/sinzbtw/rvnce',
  )
  await expect(
    github.getByLabel('Icon', { exact: true }).locator('option:checked'),
  ).toHaveText('Automatic · GitHub')
  await add('button', 'Writing', 'https://example.com/writing')
  const custom = await add('icon', 'My studio', 'https://example.com/')
  await custom.locator('input[type=file]').setInputFiles({
    name: 'studio.png',
    mimeType: 'image/png',
    buffer: await readFile(photo),
  })
  await expect(custom.getByLabel('Icon', { exact: true })).toHaveValue('custom')
  await custom.getByLabel('Tint icon with profile colors').check()
  await page.getByRole('button', { name: 'Move My studio up' }).click()
  await expect(page.locator('.profile-links li')).toHaveText([
    'Portfolio',
    'Writing',
  ])
  await expect(page.locator('.profile-social li')).toHaveText([
    'My studio',
    'GitHub projects',
  ])
  await expect(page.locator('.profile-social-tint')).toHaveCSS(
    'mask-image',
    /data:image\/png/,
  )

  const archive = unzipSync(await download(page, 'Download site'))
  expect(archive['icons/link-1.png']).toBeDefined()
  expect(strFromU8(archive['icons/Lucide-LICENSE.txt']!)).toContain(
    'ISC License',
  )
  expect(strFromU8(archive['icons/Font-Awesome-LICENSE.txt']!)).toContain(
    'CC BY 4.0',
  )
  expect(strFromU8(archive['profile.css']!)).toContain(
    'url("./icons/link-1.png")',
  )
  const host = await serveArchive(archive)
  const context = await browser.newContext({ javaScriptEnabled: false })
  try {
    const published = await context.newPage()
    const iconRequest = published.waitForResponse(
      (response) => response.url() === host.url + 'icons/link-1.png',
    )
    await published.goto(host.url)
    expect((await iconRequest).ok()).toBe(true)
    const social = published.getByRole('list', { name: 'Social links' })
    const studio = social.getByRole('link', { name: 'My studio' })
    await expect(studio).toHaveAttribute('href', 'https://example.com/')
    const githubLink = social.getByRole('link', { name: 'GitHub projects' })
    await expect(githubLink).toHaveAttribute(
      'href',
      'https://github.com/sinzbtw/rvnce',
    )
    await expect(githubLink.locator('svg.fa-github')).toBeVisible()
    if (browserName === 'webkit') {
      await studio.focus()
    } else {
      await published.keyboard.press('Tab')
      await published.keyboard.press('Tab')
      await published.keyboard.press('Tab')
    }
    await expect(studio).toBeFocused()
    await expect(studio).toHaveCSS('outline-style', 'solid')
  } finally {
    await context.close()
    await host.close()
  }
})

test('keeps branding independent of portable themes and restores the full draft', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Show preview' }).click()
  const preview = page.locator('.preview-pane .public-profile')
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
  const background = page.getByRole('dialog', { name: 'Background' })
  const openBackground = () =>
    page.getByRole('button', { name: 'Background', exact: true }).click()
  const upload = background.locator('input[aria-label="Background file"]')
  await openBackground()
  await upload.setInputFiles({
    name: 'background.png',
    mimeType: 'image/png',
    buffer: await readFile(photo),
  })
  await expect(background.locator('.profile-backdrop img')).toBeVisible()
  await background.getByRole('button', { name: 'Done' }).click()
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

  await openBackground()
  await upload.setInputFiles({
    name: 'broken.png',
    mimeType: 'image/png',
    buffer: Buffer.from('broken'),
  })
  await expect(background.getByRole('alert')).toContainText('Choose a readable')
  await expect(background.locator('.profile-backdrop img')).toBeVisible()
  await background
    .getByRole('button', { name: 'Remove background file' })
    .click()
  await background.getByRole('button', { name: 'Done' }).click()
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
      await page
        .getByRole('button', { name: 'Background', exact: true })
        .click()
      const settings = page.getByRole('dialog', { name: 'Background' })
      const input = settings.locator('input[aria-label="Background file"]')
      await input.setInputFiles({
        name: 'background.' + extension,
        mimeType,
        buffer: original,
      })
      const settingsPoster = settings.locator('.background-poster')
      const manualPoster = settings.getByRole('button', {
        name: 'Upload video poster',
      })
      await expect(settingsPoster.or(manualPoster)).toBeVisible()
      const posterOnlyPreview = await manualPoster.isVisible()
      if (posterOnlyPreview) {
        expect(extension).toBe('mp4')
        await settings
          .locator('input[aria-label="Video poster file"]')
          .setInputFiles({
            name: 'poster.png',
            mimeType: 'image/png',
            buffer: await readFile(photo),
          })
      }
      await expect(settingsPoster).toBeVisible()
      await settings.getByRole('button', { name: 'Done' }).click()
      const preview = page.locator('.preview-pane')
      const poster = preview.locator('.background-poster')
      await expect(poster).toBeVisible()
      const motion = preview.locator('.background-moving')
      if (extension === 'gif') {
        await expect(motion).toHaveAttribute(
          'src',
          (await poster.getAttribute('src'))!,
        )
      } else {
        await expect(motion).not.toHaveAttribute('src', /.+/u)
      }
      if (!posterOnlyPreview) {
        await preview.getByRole('button', { name: 'Play background' }).click()
        await expect(preview.locator('rvnce-motion')).toHaveAttribute(
          'data-playing',
          '',
        )
        if (extension === 'mp4')
          await expect(motion).toHaveJSProperty('duration', 20)
        await preview.getByRole('button', { name: 'Stop background' }).click()
        await expect(preview.locator('rvnce-motion')).not.toHaveAttribute(
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
        if (extension === 'mp4') {
          const video = animated.locator('video')
          await expect(video).toHaveJSProperty('duration', 20)
          await video.evaluate((element: HTMLVideoElement) => {
            element.currentTime = 16
          })
          await expect
            .poll(() =>
              video.evaluate(
                (element: HTMLVideoElement) =>
                  element.currentTime >= 16 &&
                  !element.seeking &&
                  !element.paused,
              ),
            )
            .toBe(true)
        }
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

test('click effects finish and clear after a rapid series of clicks', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Appearance' }).click()
  await page.getByRole('button', { name: 'Click effects' }).click()
  const dialog = page.getByRole('dialog', { name: 'Click effects' })
  for (const preset of ['ripple', 'burst', 'sparkles']) {
    await dialog
      .getByLabel('Click effect preset', { exact: true })
      .selectOption(preset)
    const count = await dialog
      .locator('.public-profile')
      .evaluate((profile) => {
        const { x, y } = profile.getBoundingClientRect()
        for (let index = 0; index < 16; index++) {
          profile.dispatchEvent(
            new MouseEvent('click', {
              bubbles: true,
              detail: 1,
              clientX: x + 25,
              clientY: y + 25,
            }),
          )
        }
        return profile.querySelectorAll('.profile-pointer-mark').length
      })
    expect(count).toBe(1)
    await expect(dialog.locator('.profile-pointer-mark')).toHaveCount(0)
  }
})
