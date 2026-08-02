/**
 * Round 11 — what the owner actually sees after clicking "Add section", for each type.
 */
import { chromium } from 'playwright'

const BASE = 'http://frontend:5173'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } })
const created = []

const api = async (p) => (await (await page.request.get(`${BASE}${p}`)).json())

try {
  for (const type of ['text-block', 'cards-grid', 'testimonials', 'image-gallery', 'cta-banner', 'hero']) {
    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2500)
    const heading = `R11 ${type} heading`
    await page.selectOption('select', type)
    await page.locator('input[aria-label="New section heading"]').fill(heading)
    await page.locator('button[aria-label="Add section"]').click()
    await page.waitForTimeout(2500)

    const rec = (await api('/api/admin/content')).sections.find((s) => s.heading === heading)
    if (rec) created.push(rec.id)
    const bodyText = await page.locator('body').innerText()
    const visible = bodyText.includes(heading)
    const boxes = await page.locator('[data-section]').count()
    console.log(`${type}: created=${!!rec} is_visible=${rec?.is_visible} headingOnScreen=${visible} sectionBoxes=${boxes}`)

    if (!visible && rec) {
      const box = page.locator('[data-section]').last()
      await box.scrollIntoViewIfNeeded()
      await page.waitForTimeout(500)
      await box.screenshot({ path: `/app/tmp-e2e/r11-newsection-${type}.png` })
      console.log(`  what the owner sees: ${JSON.stringify((await box.innerText()).replace(/\n+/g, ' | '))}`)

      // Does adding an item bring the heading back?
      const addBtn = box.locator('button:has-text("Add ")').first()
      if (await addBtn.count()) {
        await addBtn.click()
        await page.waitForTimeout(2500)
        const nowVisible = (await page.locator('body').innerText()).includes(heading)
        console.log(`  after "+ Add" the heading is on screen: ${nowVisible}`)
        await page.locator('[data-section]').last().screenshot({ path: `/app/tmp-e2e/r11-newsection-${type}-additem.png` })
      }
    } else if (rec) {
      const box = page.locator(`[data-section]:has-text("${heading}")`).first()
      await box.scrollIntoViewIfNeeded()
      await page.waitForTimeout(400)
      await box.screenshot({ path: `/app/tmp-e2e/r11-newsection-${type}.png` })
    }
  }
} finally {
  for (const id of created) {
    const r = await page.request.delete(`${BASE}/api/admin/sections/${id}`)
    console.log('deleted', id, r.status())
  }
}
await browser.close()
