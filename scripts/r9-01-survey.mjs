/**
 * Round 9 survey: back up content, show every section, screenshot public + admin
 * at 1440 / 768 / 393, then restore visibility.
 */
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const BASE = process.env.BASE_URL || 'http://frontend:5173'
const OUT = '/app/tmp-e2e'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })

const rawContent = await (await page.request.get(`${BASE}/api/admin/content`)).text()
writeFileSync(`${OUT}/r9-backup-content.json`, rawContent)
const content = JSON.parse(rawContent)
console.log('SECTIONS:', JSON.stringify(content.sections.map((s) => ({ id: s.id, type: s.type, slug: s.slug, title: s.title, is_visible: s.is_visible, items: s.items?.length })), null, 1))

const setVisible = (id, v) => page.request.put(`${BASE}/api/admin/sections/${id}`, { data: { is_visible: v } })
const original = content.sections.map((s) => ({ id: s.id, is_visible: s.is_visible }))

const widths = [
  { w: 1440, h: 1000, tag: '1440' },
  { w: 768, h: 1024, tag: '768' },
  { w: 393, h: 852, tag: '393' },
]

try {
  // --- public + admin AS SHIPPED (default visibility) --------------------------
  for (const { w, h, tag } of widths) {
    await page.setViewportSize({ width: w, height: h })
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1800)
    await page.screenshot({ path: `${OUT}/r9-public-default-${tag}.png`, fullPage: true })
  }

  // --- everything visible -------------------------------------------------------
  for (const s of original) if (!s.is_visible) await setVisible(s.id, 1)

  for (const { w, h, tag } of widths) {
    await page.setViewportSize({ width: w, height: h })
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
    await page.screenshot({ path: `${OUT}/r9-public-all-${tag}.png`, fullPage: true })
    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2500)
    await page.screenshot({ path: `${OUT}/r9-admin-${tag}.png`, fullPage: true })
  }

  // --- console errors on both pages --------------------------------------------
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  console.log('CONSOLE ERRORS:', JSON.stringify(errors, null, 1))
} finally {
  for (const s of original) await setVisible(s.id, s.is_visible)
  console.log('visibility restored:', JSON.stringify(original))
}

await browser.close()
