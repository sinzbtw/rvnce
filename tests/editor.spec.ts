import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { unzipSync } from 'fflate'
import type { ProfileDocument } from '../src/profile/document'

const avatarFixture = new URL('../src/assets/mira-park.png', import.meta.url)

test('edits, restores, imports and exports a standalone profile', async ({
  page,
  browser,
}) => {
  await page.goto('/')
  await page.getByLabel('Display name').fill('Ира Moon')
  await page.getByLabel('Bio').fill('Studio notes & visual work.')
  await page
    .locator('input[accept="image/png,image/jpeg,image/webp"]')
    .setInputFiles({
      name: 'portrait.png',
      mimeType: 'image/png',
      buffer: await readFile(avatarFixture),
    })
  await expect(page.getByRole('button', { name: 'Change photo' })).toBeEnabled()
  await expect(page.locator('.public-profile h1')).toHaveText('Ира Moon')
  await page.getByRole('button', { name: 'Links', exact: true }).click()
  await page.getByRole('button', { name: 'Add link' }).click()
  const newLink = page.getByRole('group', { name: 'Link 4' })
  await expect(newLink.getByLabel('Label')).toBeFocused()
  await newLink.getByLabel('Label').fill('Work')
  await newLink.getByLabel('URL').fill('https://example.org/work')
  await page.getByRole('button', { name: 'Move Work up' }).click()
  await expect(page.locator('.public-profile a').nth(2)).toHaveText('Work')
  await page.getByRole('button', { name: 'Appearance' }).click()
  await page.getByRole('radio', { name: 'Dark' }).check()
  await page.getByRole('button', { name: 'Forest' }).click()
  await page.reload()
  await expect(page.getByLabel('Display name')).toHaveValue('Ира Moon')
  await expect(page.locator('.public-profile')).toHaveAttribute(
    'data-variant',
    'dark',
  )
  await expect(page.locator('.public-profile a').nth(2)).toHaveText('Work')

  const jsonEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON' }).click()
  const json = await jsonEvent
  const jsonPath = await json.path()
  expect(jsonPath).toBeTruthy()
  const profile = JSON.parse(
    await readFile(jsonPath!, 'utf8'),
  ) as ProfileDocument
  expect(profile.profile.avatar).toBeTruthy()
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
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON' }).click()
  expect((await download).suggestedFilename()).toBe('rvnce-profile.json')
})

test('preserves incomplete edits and focuses the invalid field on export', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Links', exact: true }).click()
  await page.getByRole('button', { name: 'Add link' }).click()
  await page
    .getByRole('group', { name: 'Link 4' })
    .getByLabel('Label')
    .fill('New destination')
  await page.reload()
  await page.getByRole('button', { name: 'Download site' }).click()
  const invalidLink = page.getByRole('group', { name: 'Link 4' })
  await expect(invalidLink.getByLabel('Label')).toHaveValue('New destination')
  await expect(invalidLink.getByLabel('URL')).toBeFocused()
  await expect(
    page.getByText('Complete the highlighted fields before downloading.'),
  ).toBeVisible()
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
  await expect(page.getByRole('button', { name: 'Import JSON' })).toBeFocused()
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

  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    if (width <= 730) {
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
    if (width > 730) {
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
  await page.getByRole('button', { name: 'Editor', exact: true }).click()
  await page.getByLabel('Display name').fill('ДлинноеИмя'.repeat(8))
  await page.getByRole('button', { name: 'Links', exact: true }).click()
  await page
    .getByRole('group', { name: 'Link 1' })
    .getByLabel('Label')
    .fill('X'.repeat(80))
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

  const demoHref = await page
    .getByRole('link', { name: 'View demo' })
    .getAttribute('href')
  expect(demoHref).toBe('./demo/index.html')
  await page.goto(new URL(demoHref!, page.url()).href)
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.getByRole('heading', { name: 'Mira Park' })).toBeVisible()
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
