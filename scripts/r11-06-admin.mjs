/**
 * Round 11 — admin surface: header buttons, section controls, editing, icon picker,
 * pencil affordance, and the "new section starts unpublished" fix.
 * Every mutation is undone.
 */
import { chromium } from 'playwright'

const BASE = 'http://frontend:5173'
const out = []
const check = (name, pass, detail = '') => {
  out.push(pass)
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } })
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(e.message))

const api = async (path) => (await (await page.request.get(`${BASE}${path}`)).json())
const setVisible = (id, v) => page.request.put(`${BASE}/api/admin/sections/${id}`, { data: { is_visible: v } })

const before = await api('/api/admin/content')
const original = before.sections.map((s) => ({ id: s.id, is_visible: s.is_visible, sort_order: s.sort_order }))
const originalPage = before.page
const cleanup = []

try {
  for (const s of original) if (!s.is_visible) await setVisible(s.id, 1)

  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/app/tmp-e2e/r11-admin-1440-top.png' })
  await page.screenshot({ path: '/app/tmp-e2e/r11-admin-1440-full.png', fullPage: true })

  // ---- header buttons ---------------------------------------------------------
  const storage = page.locator('button[aria-label="Check storage usage"]')
  await storage.click()
  await page.waitForTimeout(3000)
  const storageLabel = (await storage.innerText()).trim()
  check('“Check storage” reports a real figure', /Storage .* of /.test(storageLabel), `"${storageLabel}"`)
  const quotaBar = await page.locator('[aria-label^="Storage"][aria-label$="used"]').count()
  check('a storage bar appears with an accessible label', quotaBar === 1)
  await page.screenshot({ path: '/app/tmp-e2e/r11-admin-storage.png', clip: { x: 0, y: 0, width: 1440, height: 160 } })

  await page.locator('button[aria-label="Reload content from the server"]').click()
  await page.waitForTimeout(2000)
  check('“Refresh” leaves the page intact', (await page.locator('[data-section]').count()) === original.length, `${await page.locator('[data-section]').count()} sections`)

  const viewSite = page.locator('a[aria-label="View site"]')
  check('“View site” points at the public page', (await viewSite.getAttribute('href')) === '/')

  // ---- pencil affordance (fix #5) ---------------------------------------------
  const pencilOpacity = async () =>
    page.locator('span.editor-chrome:has-text("✎ Edit")').first().evaluate((el) => getComputedStyle(el).opacity)
  await page.setViewportSize({ width: 393, height: 850 })
  await page.waitForTimeout(600)
  const mobileOpacity = await pencilOpacity()
  check('the ✎ Edit hint is visible on a phone', Number(mobileOpacity) > 0.5, `opacity ${mobileOpacity}`)
  await page.screenshot({ path: '/app/tmp-e2e/r11-admin-393-pencil.png' })
  await page.setViewportSize({ width: 1440, height: 1200 })
  await page.waitForTimeout(600)
  const desktopOpacity = await pencilOpacity()
  check('the ✎ Edit hint is hidden until hover on desktop', Number(desktopOpacity) === 0, `opacity ${desktopOpacity}`)
  const firstEditable = page.locator('button[aria-label^="Edit "]').first()
  await firstEditable.hover()
  await page.waitForTimeout(500)
  check('hovering reveals the ✎ Edit hint on desktop', Number(await pencilOpacity()) > 0.5, `opacity ${await pencilOpacity()}`)

  // ---- inline editing ----------------------------------------------------------
  const heroHeading = page.locator('button[aria-label="Edit Hero heading"]').first()
  await heroHeading.click()
  await page.waitForTimeout(600)
  const ta = page.locator('textarea[aria-label="Hero heading"]').first()
  check('clicking a heading opens an editor', await ta.count() === 1)
  await page.screenshot({ path: '/app/tmp-e2e/r11-admin-editing.png', clip: { x: 0, y: 200, width: 1440, height: 500 } })
  await ta.fill('Round 11 heading probe')
  await page.locator('button[aria-label="Save"]').first().click()
  await page.waitForTimeout(2000)
  cleanup.push(() => page.request.put(`${BASE}/api/admin/sections/sec_hero`, { data: { heading: before.sections.find((s) => s.id === 'sec_hero').heading } }))
  const savedBadge = await page.locator('text=Saved ✓').count()
  check('a save shows a “Saved ✓” confirmation', savedBadge > 0)
  const heroNow = (await api('/api/admin/content')).sections.find((s) => s.id === 'sec_hero').heading
  check('the edit reaches the database', heroNow === 'Round 11 heading probe', `"${heroNow}"`)
  await page.screenshot({ path: '/app/tmp-e2e/r11-admin-saved.png', clip: { x: 0, y: 200, width: 1440, height: 400 } })

  // Escape cancels
  await heroHeading.click()
  await page.waitForTimeout(500)
  await page.locator('textarea[aria-label="Hero heading"]').first().fill('DISCARD ME')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(800)
  const afterEsc = (await api('/api/admin/content')).sections.find((s) => s.id === 'sec_hero').heading
  check('Escape discards an edit', afterEsc === 'Round 11 heading probe', `"${afterEsc}"`)

  // Required field refuses blank
  await heroHeading.click()
  await page.waitForTimeout(500)
  await page.locator('textarea[aria-label="Hero heading"]').first().fill('   ')
  await page.locator('button[aria-label="Save"]').first().click()
  await page.waitForTimeout(700)
  const reqErr = await page.locator('text=Value required').count()
  check('a required heading refuses to be emptied', reqErr > 0)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)

  // ---- icon picker (fix #3) -----------------------------------------------------
  const iconBtn = page.locator('button[aria-label^="Change the icon for"]').first()
  check('the services grid has an icon picker', await iconBtn.count() > 0)
  await iconBtn.scrollIntoViewIfNeeded()
  await iconBtn.click()
  await page.waitForTimeout(500)
  check('the icon picker opens', await page.locator('text=Pick an icon').count() > 0)
  await page.screenshot({ path: '/app/tmp-e2e/r11-admin-iconpicker.png' })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  check('Escape closes the icon picker', await page.locator('text=Pick an icon').count() === 0)
  await iconBtn.click()
  await page.waitForTimeout(400)
  await page.locator('h1').first().click({ force: true })
  await page.waitForTimeout(400)
  check('an outside click closes the icon picker', await page.locator('text=Pick an icon').count() === 0)
  await page.keyboard.press('Escape')

  // Choosing an icon actually saves
  const svc = (await api('/api/admin/content')).sections.find((s) => s.type === 'cards-grid')
  const firstSvcItem = svc.items.sort((a, b) => a.sort_order - b.sort_order)[0]
  cleanup.push(() => page.request.put(`${BASE}/api/admin/items/${firstSvcItem.id}`, { data: { icon: firstSvcItem.icon } }))
  await iconBtn.scrollIntoViewIfNeeded()
  await iconBtn.click()
  await page.waitForTimeout(400)
  await page.locator('button[aria-label^="Use 🏆"]').first().click()
  await page.waitForTimeout(2000)
  const iconNow = (await api('/api/admin/content')).sections.find((s) => s.type === 'cards-grid').items.find((i) => i.id === firstSvcItem.id).icon
  check('picking an icon saves it', iconNow === '🏆', `"${iconNow}"`)

  // ---- new section starts unpublished (fix #2) ----------------------------------
  await page.locator('input[aria-label="New section heading"]').scrollIntoViewIfNeeded()
  await page.locator('button[aria-label="Add section"]').click()
  await page.waitForTimeout(700)
  const blankErr = await page.locator('text=Give the new section a heading first.').count()
  check('adding a section with no heading explains itself inline', blankErr === 1)
  await page.screenshot({ path: '/app/tmp-e2e/r11-admin-addsection-error.png', clip: { x: 0, y: 200, width: 1440, height: 400 } })

  await page.locator('input[aria-label="New section heading"]').fill('R11 probe section')
  await page.locator('button[aria-label="Add section"]').click()
  await page.waitForTimeout(2500)
  const after = await api('/api/admin/content')
  const created = after.sections.find((s) => s.heading === 'R11 probe section')
  check('the new section is created', !!created)
  if (created) {
    cleanup.push(() => page.request.delete(`${BASE}/api/admin/sections/${created.id}`))
    check('a new section starts unpublished', created.is_visible === 0, `is_visible=${created.is_visible}`)
    const publicHtml = await (await page.request.get(`${BASE}/api/content/home`)).json()
    check('the new empty section is not on the live site', !JSON.stringify(publicHtml).includes('R11 probe section'))
    const badge = await page.locator(`[data-section]:has-text("R11 probe section") >> text=Hidden — not on live site`).count()
    check('the admin marks it “Hidden — not on live site”', badge > 0)
    await page.locator(`[data-section]:has-text("R11 probe section")`).first().scrollIntoViewIfNeeded()
    await page.waitForTimeout(400)
    await page.locator(`[data-section]:has-text("R11 probe section")`).first().screenshot({ path: '/app/tmp-e2e/r11-admin-newsection.png' })
  }

  check('no uncaught errors in the admin', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '))
} finally {
  for (const fn of cleanup.reverse()) { try { const r = await fn(); console.log('cleanup status', r?.status?.()) } catch (e) { console.log('cleanup failed', e.message) } }
  for (const s of original) await setVisible(s.id, s.is_visible)
  await page.request.put(`${BASE}/api/admin/pages/home`, { data: originalPage })
  console.log('restored')
}

console.log(`\n${out.filter(Boolean).length}/${out.length} passed`)
await browser.close()
