import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { crc32 } from 'node:zlib'
import { unzipSync } from 'fflate'
import { demoProfile } from '../src/profile/demo'
import type { ProfileDocument } from '../src/profile/document'

const avatarFixture = new URL('../src/assets/mira-park.png', import.meta.url)

test('edits, restores, imports and exports a standalone profile', async ({
  page,
  browser,
}) => {
  await page.addInitScript(
    (raw) => {
      localStorage.setItem('rvnce.draft.v1', raw)
    },
    JSON.stringify(demoProfile(null)),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Show preview' }).click()
  await page.getByLabel('Display name').fill('Ира Moon')
  await page.getByLabel('Bio').fill('Studio notes & visual work.')
  await page.getByLabel('Page language').fill('ru')
  await page
    .locator('input[accept="image/png,image/jpeg,image/webp"]')
    .setInputFiles({
      name: 'portrait.png',
      mimeType: 'image/png',
      buffer: await readFile(avatarFixture),
    })
  await expect(page.getByRole('button', { name: 'Change photo' })).toBeEnabled()
  await page.locator('#favicon-file').setInputFiles({
    name: 'tab-icon.png',
    mimeType: 'image/png',
    buffer: await readFile(avatarFixture),
  })
  await expect(page.locator('.preview-tab img')).toHaveJSProperty(
    'naturalWidth',
    64,
  )
  await expect(page.locator('.public-profile h1')).toHaveText('Ира Moon')
  await page.getByRole('button', { name: 'Links', exact: true }).click()
  await page.getByRole('button', { name: 'Add link' }).click()
  const newLink = page.getByRole('group', { name: 'Link 4' })
  await expect(newLink.getByLabel('Label')).toBeFocused()
  await newLink.getByLabel('Label').fill('Work')
  await newLink.getByLabel('URL').fill('https://example.org/work')
  await page.getByRole('button', { name: 'Move Work up' }).click()
  await expect(page.locator('.profile-link').nth(2)).toHaveText('Work')
  await page.getByRole('button', { name: 'Move Work down' }).press('Enter')
  await expect(page.getByRole('button', { name: 'Move Work up' })).toBeFocused()
  await page.getByRole('button', { name: 'Move Work up' }).press('Enter')
  await expect(page.locator('.public-profile a')).toHaveCount(0)
  await page.getByRole('button', { name: 'Appearance' }).click()
  await page.getByRole('radio', { name: 'Dark' }).check()
  await page.getByText('Card and avatar', { exact: true }).click()
  await page.getByLabel('Accent color', { exact: true }).fill('#176451')
  await expect(page.getByText('Saved locally')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Show preview' }).click()
  await expect(page.getByLabel('Display name')).toHaveValue('Ира Moon')
  await expect(page.locator('.public-profile')).toHaveAttribute(
    'data-variant',
    'dark',
  )
  await expect(page.locator('.profile-link').nth(2)).toHaveText('Work')

  const jsonEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON' }).click()
  const json = await jsonEvent
  const jsonPath = await json.path()
  expect(jsonPath).toBeTruthy()
  const profile = JSON.parse(
    await readFile(jsonPath!, 'utf8'),
  ) as ProfileDocument
  expect(profile.profile.avatar).toBeTruthy()
  expect(profile.schemaVersion).toBe(4)
  expect(profile.branding.favicon).toBeTruthy()
  expect(profile.appearance.accent).toBe('#176451')

  const input = page.locator('input[accept=".json,application/json"]')
  await input.setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{'),
  })
  await expect(
    page.getByText('This file does not contain valid JSON.'),
  ).toBeVisible()
  await expect(page.getByLabel('Display name')).toHaveValue('Ира Moon')
  await page.getByLabel('Display name').fill('Temporary')
  await input.setInputFiles(jsonPath!)
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByLabel('Display name')).toHaveValue('Temporary')
  await input.setInputFiles(jsonPath!)
  await page.getByRole('button', { name: 'Replace profile' }).click()
  await expect(page.getByLabel('Display name')).toHaveValue('Ира Moon')

  const zipEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download site' }).click()
  const zip = await zipEvent
  expect(zip.suggestedFilename()).toBe('rvnce-site.zip')
  const files = unzipSync(await readFile((await zip.path())!))
  const types: Record<string, string> = {
    html: 'text/html; charset=utf-8',
    css: 'text/css',
    png: 'image/png',
    woff2: 'font/woff2',
  }
  const prefix = '/repository/subsite/'
  const server = createServer((req, res) => {
    const url = req.url ?? ''
    const path = url.startsWith(prefix)
      ? url.slice(prefix.length) || 'index.html'
      : ''
    const bytes = files[path]
    res.writeHead(bytes ? 200 : 404, {
      'Content-Type': types[path.split('.').at(-1) ?? ''] ?? 'text/plain',
    })
    res.end(bytes)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Test site did not start.')
  const publicContext = await browser.newContext({ javaScriptEnabled: false })
  try {
    const published = await publicContext.newPage()
    const httpRequests: string[] = []
    published.on('response', (response) => {
      if (response.ok()) httpRequests.push(new URL(response.url()).pathname)
    })
    await published.goto('http://127.0.0.1:' + address.port + prefix, {
      waitUntil: 'networkidle',
    })
    await expect(
      published.getByRole('heading', { name: 'Ира Moon' }),
    ).toBeVisible()
    await expect(published.getByRole('link', { name: 'Work' })).toHaveAttribute(
      'href',
      'https://example.org/work',
    )
    await expect(published.locator('script')).toHaveCount(0)
    await expect(published.locator('html')).toHaveAttribute('lang', 'ru')
    await expect(published.locator('link[rel="icon"]')).toHaveAttribute(
      'href',
      './favicon.png',
    )
    const icon = await published.request.get(
      'http://127.0.0.1:' + address.port + prefix + 'favicon.png',
    )
    expect(icon.ok()).toBe(true)
    expect((await icon.body()).readUInt32BE(16)).toBe(64)
    expect(httpRequests).toEqual(
      expect.arrayContaining([
        prefix + 'profile.css',
        prefix + 'avatar.png',
        prefix + 'fonts/manrope-cyrillic.woff2',
        prefix + 'fonts/manrope-latin.woff2',
      ]),
    )
  } finally {
    await publicContext.close()
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  }
})

test('warns when storage is unavailable and keeps exports usable', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const blocked = () => {
      throw new DOMException('Storage blocked', 'SecurityError')
    }
    Storage.prototype.getItem = blocked
    Storage.prototype.setItem = blocked
    IDBFactory.prototype.open = blocked
  })
  await page.goto('/')
  const warning = page.getByText(
    'Changes may be lost if you refresh or close this page.',
    { exact: false },
  )
  await expect(warning).toBeVisible()
  await page.getByLabel('Display name').fill('Local only')
  await expect(page.locator('.public-profile h1')).toHaveText('Local only')
  await expect(warning).toBeVisible()
  await page.getByRole('button', { name: 'Links', exact: true }).click()
  await page.getByRole('button', { name: 'Add link' }).click()
  await page
    .getByRole('group', { name: 'Link 1' })
    .getByText('Enter a link label.')
    .waitFor()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON' }).click()
  const backup = await download
  expect(backup.suggestedFilename()).toBe('rvnce-profile.json')
  await page
    .locator('input[accept=".json,application/json"]')
    .setInputFiles((await backup.path())!)
  await page.getByRole('button', { name: 'Replace profile' }).click()
  await page.getByRole('button', { name: 'Links', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Link 1' })).toBeVisible()
})

test('preserves incomplete edits and focuses the invalid field on export', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByLabel('Display name').fill('Draft with a link')
  await page.getByRole('button', { name: 'Links', exact: true }).click()
  await page.getByRole('button', { name: 'Add link' }).click()
  await page
    .getByRole('group', { name: 'Link 1' })
    .getByLabel('Label')
    .fill('New destination')
  await expect(page.getByText('Saved locally')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Download site' }).click()
  const invalidLink = page.getByRole('group', { name: 'Link 1' })
  await expect(invalidLink.getByLabel('Label')).toHaveValue('New destination')
  await expect(invalidLink.getByLabel('URL')).toBeFocused()
  await expect(
    page.getByText('Complete the highlighted fields before downloading.'),
  ).toBeVisible()
})

test('protects edits across tabs and offers a copy of the conflicting draft', async ({
  page,
  context,
}) => {
  await page.goto('/')
  await expect(page.getByLabel('Display name')).toHaveValue('')
  const second = await context.newPage()
  await second.goto('/')
  await expect(second.getByLabel('Display name')).toHaveValue('')

  await page.getByLabel('Display name').fill('Saved in the first tab')
  await expect(page.getByText('Saved locally')).toBeVisible()
  await expect(
    second.getByText('The saved draft changed in another tab.', {
      exact: false,
    }),
  ).toBeVisible()
  await second
    .getByLabel('Bio', { exact: true })
    .fill('Local bio in the second tab')
  const download = second.waitForEvent('download')
  await second.getByRole('button', { name: 'Download my copy' }).click()
  const file = await download
  const backup = JSON.parse(
    await readFile((await file.path())!, 'utf8'),
  ) as ProfileDocument
  expect(backup.profile.bio).toBe('Local bio in the second tab')

  await second.getByRole('button', { name: 'Load saved draft' }).click()
  await expect(second.getByLabel('Display name')).toHaveValue(
    'Saved in the first tab',
  )
  await expect(second.getByLabel('Bio', { exact: true })).toHaveValue('')
  await second.getByLabel('Bio', { exact: true }).fill('Updated after loading')
  await expect(second.getByText('Saved locally')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Display name')).toHaveValue(
    'Saved in the first tab',
  )
  await expect(page.getByLabel('Bio', { exact: true })).toHaveValue(
    'Updated after loading',
  )
})

test('recovers an old draft and preserves edited text with page breaks', async ({
  page,
}) => {
  const legacy = {
    schemaVersion: 1,
    profile: { name: 'Recovered draft', bio: 'First\fSecond', avatar: null },
    appearance: { theme: 'rvnce', variant: 'light', accent: '#4434d4' },
    blocks: [],
  }
  await page.addInitScript((raw) => {
    if (localStorage.getItem('rvnce.draft.v1') === null)
      localStorage.setItem('rvnce.draft.v1', raw)
  }, JSON.stringify(legacy))
  await page.goto('/')
  await expect(
    page.getByText('The saved draft was recovered.', { exact: false }),
  ).toBeVisible()
  await expect(page.getByLabel('Display name')).toHaveValue('Recovered draft')
  await expect(page.getByLabel('Bio', { exact: true })).toHaveValue(
    'First\nSecond',
  )
  await page.getByLabel('Bio', { exact: true }).fill('Left\fRight')
  await expect(page.getByText('Saved locally')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Bio', { exact: true })).toHaveValue(
    'Left\nRight',
  )
})

test('keeps unreadable storage until replacement is explicitly requested', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('rvnce.draft.v1') === null)
      localStorage.setItem('rvnce.draft.v1', '{"previous":')
  })
  await page.goto('/')
  await page.getByLabel('Display name').fill('Replacement draft')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download original' }).click()
  const original = await download
  expect(await readFile((await original.path())!, 'utf8')).toBe('{"previous":')
  await page.getByRole('button', { name: 'Replace saved draft' }).click()
  await expect(page.getByText('Saved locally')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Display name')).toHaveValue('Replacement draft')
})

test('ignores an older import that finishes after a newer selection', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const read = File.prototype.text
    File.prototype.text = async function () {
      if (this.name !== 'older.json') return read.call(this)
      await new Promise<void>((resolve) => {
        window.addEventListener('release-older-import', () => resolve(), {
          once: true,
        })
      })
      const text = await read.call(this)
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          window.dispatchEvent(new Event('older-import-read'))
        }),
      )
      return text
    }
  })
  await page.goto('/')
  const input = page.locator('input[accept=".json,application/json"]')
  const doc = demoProfile(null)
  doc.profile.name = 'Older selection'
  await input.setInputFiles({
    name: 'older.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(doc)),
  })
  doc.profile.name = 'Newer selection'
  await input.setInputFiles({
    name: 'newer.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(doc)),
  })
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Newer selection')).toBeVisible()
  await dialog.getByRole('button', { name: 'Replace profile' }).click()
  await expect(page.getByLabel('Display name')).toHaveValue('Newer selection')
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        window.addEventListener('older-import-read', () => resolve(), {
          once: true,
        })
        window.dispatchEvent(new Event('release-older-import'))
      }),
  )
  await expect(dialog).toBeHidden()
  await expect(page.getByLabel('Display name')).toHaveValue('Newer selection')
})

test('opens an empty profile, reports bad photos, and retries ZIP export', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByLabel('Display name')).toHaveValue('')
  await expect(page.locator('.profile-portrait img')).toHaveCount(0)

  const png = await readFile(avatarFixture)
  await page
    .locator('input[accept="image/png,image/jpeg,image/webp"]')
    .setInputFiles({
      name: 'incomplete.png',
      mimeType: 'image/png',
      buffer: png.subarray(0, 33),
    })
  await expect(page.getByRole('alert')).toHaveText(
    'This image could not be opened.',
  )

  const metadata = Buffer.from('tEXtComment\0Rvnce test note')
  const chunk = Buffer.alloc(metadata.length + 8)
  chunk.writeUInt32BE(metadata.length - 4)
  metadata.copy(chunk, 4)
  chunk.writeUInt32BE(crc32(metadata), chunk.length - 4)
  const iend = png.length - 12
  const doc = demoProfile(
    Buffer.concat([png.subarray(0, iend), chunk, png.subarray(iend)]).toString(
      'base64',
    ),
  )
  await page.locator('input[accept=".json,application/json"]').setInputFiles({
    name: 'profile.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(doc)),
  })
  await page.getByRole('button', { name: 'Replace profile' }).click()

  await page.route('**/*.woff2', (route) =>
    route.request().resourceType() === 'fetch'
      ? route.abort()
      : route.continue(),
  )
  const button = page.getByRole('button', { name: 'Download site' })
  await button.click()
  await expect(
    page.getByText('An export asset could not load. Try again.'),
  ).toBeVisible()
  await expect(button).toBeEnabled()
  await page.unroute('**/*.woff2')
  const download = page.waitForEvent('download')
  await button.click()
  const zip = await download
  const files = unzipSync(await readFile((await zip.path())!))
  expect(files['avatar.png']).toBeDefined()
  expect(Buffer.from(files['avatar.png']!).includes('Rvnce test note')).toBe(
    false,
  )
})

test('checks keyboard, contrast, mobile layout, long content and reduced motion', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Edit profile' }),
  ).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.locator('.preferences-trigger')).toBeFocused()
  await expect(page.locator('.preview-frame')).toHaveCSS(
    'animation-name',
    'none',
  )
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([])

  await page.getByRole('button', { name: 'Show preview' }).click()
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    if (width < 860) {
      await page.getByRole('button', { name: 'Editor', exact: true }).click()
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width)
      await page.getByRole('button', { name: 'Preview', exact: true }).click()
    }
    await expect(
      page.getByRole('heading', { name: 'Live preview' }),
    ).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width)
    const phone = page.getByRole('button', { name: 'Phone preview' })
    if (width >= 860) {
      expect((await phone.boundingBox())?.height).toBeGreaterThanOrEqual(44)
      await phone.click()
      await expect(page.locator('.preview-frame')).toHaveAttribute(
        'data-device',
        'phone',
      )
      await page.getByRole('button', { name: 'Wide preview' }).click()
    } else {
      await expect(phone).toBeHidden()
      const headerButtons = await page
        .locator('.header-actions button')
        .evaluateAll((buttons) =>
          buttons.map((button) => button.getBoundingClientRect().top),
        )
      expect(new Set(headerButtons).size).toBe(1)
    }
    if (process.env.RVNCE_VISUAL_CHECK) {
      await page.screenshot({
        path: testInfo.outputPath('editor-' + width + '.png'),
        fullPage: true,
      })
    }
  }
  await page.locator('.preferences-trigger').click()
  await page.getByLabel('Editor language').click({ trial: true })
  await page.locator('.brand').click()
  await expect(page.locator('.preferences-popover')).toBeHidden()
  await page.getByRole('button', { name: 'Editor', exact: true }).click()
  const largeText = await page.addStyleTag({
    content: 'html { font-size: 200%; }',
  })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320)
  await largeText.evaluate((style) => style.parentNode?.removeChild(style))
  await page.getByLabel('Display name').fill('ДлинноеИмя'.repeat(8))
  await page.getByRole('button', { name: 'Links', exact: true }).click()
  await page.getByRole('button', { name: 'Add link' }).click()
  await page
    .getByRole('group', { name: 'Link 1' })
    .getByLabel('Label')
    .fill('X'.repeat(80))
  await page
    .getByRole('group', { name: 'Link 1' })
    .getByLabel('URL')
    .fill('https://example.org')
  await page.getByRole('button', { name: 'Appearance' }).click()
  await page.getByRole('radio', { name: 'Dark' }).check()
  await page.getByRole('button', { name: 'Preview', exact: true }).click()
  await expect(page.locator('.public-profile')).toHaveAttribute(
    'data-variant',
    'dark',
  )
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320)
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([])

  await page.getByText('Examples', { exact: true }).click()
  const demoHref = await page
    .getByRole('link', { name: 'Graphic' })
    .getAttribute('href')
  expect(demoHref).toBe('./demo/index.html')
  await page.goto(new URL(demoHref!, page.url()).href)
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.getByRole('heading', { name: 'sinz' })).toBeVisible()
    await expect(page.locator('.profile-portrait img')).toHaveJSProperty(
      'naturalWidth',
      384,
    )
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width)
    if (process.env.RVNCE_VISUAL_CHECK) {
      await page.screenshot({
        path: testInfo.outputPath('demo-' + width + '.png'),
        fullPage: true,
      })
    }
  }
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([])
})

test('localizes the workspace and preview without changing profile content', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'languages', {
      get: () => ['uk-UA', 'es-MX', 'en'],
    })
  })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  const locale = page.locator('#editor-language')
  const theme = page.locator('#editor-theme')
  const editorSettings = page.locator('.preferences-trigger')
  const preferences = page.locator('.preferences-popover')
  const activeTheme = theme.locator('[aria-pressed="true"]')
  await page.locator('.preview-toggle').click()
  await expect(
    page.getByRole('heading', { name: 'Editar perfil' }),
  ).toBeVisible()
  await expect(page.locator('.public-profile h1')).toHaveText('Tu nombre')
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light dark')
  await expect(page.locator('.public-profile')).toHaveAttribute(
    'data-variant',
    'light',
  )
  await editorSettings.press('Enter')
  await expect(preferences).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(locale).toBeFocused()
  await expect(locale).toHaveValue('es')
  await expect(activeTheme).toHaveAttribute('data-theme', 'system')
  await theme.locator('[data-theme="light"]').click()
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light')
  await page.keyboard.press('Escape')
  await expect(preferences).toBeHidden()
  await expect(editorSettings).toBeFocused()
  await page.getByLabel('Nombre visible').fill('Mira · ミラ')
  await page.getByLabel('Idioma de la página').fill('ja')
  await expect(page.getByText('Guardado localmente')).toBeVisible()

  await editorSettings.click()
  const credit = page.locator('.profile-footer')
  for (const [value, name, label] of [
    ['en', 'English', 'Made with Rvnce'],
    ['ru', 'Русский', 'Сделано в Rvnce'],
    ['es', 'Español', 'Hecho con Rvnce'],
    ['pt-BR', 'Português (Brasil)', 'Feito com Rvnce'],
    ['fr', 'Français', 'Créé avec Rvnce'],
    ['de', 'Deutsch', 'Erstellt mit Rvnce'],
  ]) {
    await expect(locale.locator('option[value="' + value + '"]')).toHaveText(
      name!,
    )
    await locale.selectOption(value!)
    await expect(page.locator('html')).toHaveAttribute('lang', value!)
    await expect(credit).toHaveText(label!)
    await expect(page.locator('.public-profile')).toHaveAttribute('lang', 'ja')
    await expect(page.locator('#profile-name')).toHaveValue('Mira · ミラ')
  }
  await theme.locator('[data-theme="dark"]').click()
  await page.keyboard.press('Escape')
  await page.locator('input[accept=".json,application/json"]').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{'),
  })
  await expect(
    page.getByText('Diese Datei enthält kein gültiges JSON.'),
  ).toBeVisible()
  await editorSettings.click()
  await locale.selectOption('ru')
  await page.keyboard.press('Escape')
  await expect(page.getByText('В файле некорректный JSON.')).toBeVisible()
  await page.reload()
  await editorSettings.click()
  await expect(locale).toHaveValue('ru')
  await expect(activeTheme).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
  await page.keyboard.press('Escape')
  await expect(page.getByLabel('Отображаемое имя')).toHaveValue('Mira · ミラ')
  await expect(page.getByLabel('Язык страницы')).toHaveValue('ja')
  await expect(page.locator('.public-profile')).toHaveAttribute(
    'data-variant',
    'light',
  )
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([])
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await editorSettings.click()
  await theme.locator('[data-theme="light"]').click()
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light')
  await expect(page.locator('html')).not.toHaveClass(/theme-switching/u)
})

test('moves a floating preview and restores the mobile editing position', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/')
  const preview = page.locator('#preview-pane')
  await expect(preview).toBeHidden()
  const settings = page.locator('.settings')
  const sidebar = await page.locator('.editor-sidebar').boundingBox()
  expect((await settings.boundingBox())!.x).toBeGreaterThanOrEqual(
    sidebar!.width,
  )
  await page.getByRole('button', { name: 'Appearance', exact: true }).click()
  await page.getByText('Typography', { exact: true }).click()
  await page.getByText('Card and avatar', { exact: true }).click()
  await page.getByRole('button', { name: 'Show preview' }).press('Enter')
  await expect(preview).toBeVisible()
  const grip = page.getByRole('button', { name: 'Move preview' })
  await expect(grip).toBeFocused()
  const initial = (await preview.boundingBox())!
  await page.evaluate(() => window.scrollTo(0, 640))
  await expect
    .poll(async () => (await preview.boundingBox())?.y)
    .toBe(initial.y)
  const handle = (await grip.boundingBox())!
  await page.mouse.move(
    handle.x + handle.width / 2,
    handle.y + handle.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    handle.x + handle.width / 2 - 130,
    handle.y + handle.height / 2 - 60,
    { steps: 5 },
  )
  await page.mouse.up()
  await expect
    .poll(async () => (await preview.boundingBox())?.x)
    .toBeLessThan(initial.x - 100)
  await grip.press('Home')
  await expect
    .poll(async () => (await preview.boundingBox())?.x)
    .toBe(initial.x)
  await grip.press('Escape')
  await expect(preview).toBeHidden()
  await expect(page.getByRole('button', { name: 'Show preview' })).toBeFocused()

  await page.setViewportSize({ width: 390, height: 700 })
  await page.evaluate(() => window.scrollTo(0, 620))
  const scroll = await page.evaluate(() => window.scrollY)
  expect(scroll).toBeGreaterThan(450)
  await page.getByRole('button', { name: 'Preview', exact: true }).click()
  await expect(preview).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  await page.getByRole('button', { name: 'Editor', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scroll)
  await expect(page.getByText('Card and avatar', { exact: true })).toBeVisible()
})

test('keeps link operations responsive and disables motion on request', async ({
  page,
}) => {
  await page.addInitScript(
    (raw) => localStorage.setItem('rvnce.draft.v1', raw),
    JSON.stringify(demoProfile(null)),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Links', exact: true }).click()
  const first = page.getByRole('button', { name: 'Move Rvnce on GitHub down' })
  const animated = await first.evaluate(async (button) => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    return Boolean(
      document.querySelector('[data-link-row="link-1"]')?.getAnimations()
        .length,
    )
  })
  expect(animated).toBe(true)
  await page
    .getByRole('button', { name: 'Move Rvnce on GitHub up' })
    .press('Enter')
  await expect(page.locator('[data-link-row]').first()).toHaveAttribute(
    'data-link-row',
    'link-1',
  )
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: 'Remove Rvnce on GitHub' }).click()
  await expect(page.locator('[data-link-row]')).toHaveCount(2)
  await expect(page.locator('.link-exit')).toHaveCount(0)
  await expect(
    page.getByRole('group', { name: 'Link 1' }).getByLabel('Label'),
  ).toBeFocused()
  expect(
    await page
      .locator('.editor-panel')
      .evaluate(
        (panel) =>
          panel
            .getAnimations({ subtree: true })
            .filter(
              (animation) =>
                animation.effect instanceof KeyframeEffect &&
                animation.effect
                  .getKeyframes()
                  .some((frame) => 'transform' in frame),
            ).length,
      ),
  ).toBe(0)
})
