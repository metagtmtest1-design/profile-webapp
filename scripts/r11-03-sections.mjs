/**
 * Round 11 — per-section screenshots at 393 and 768 so each band can be judged on its own.
 */
import { chromium } from 'playwright'

const BASE = 'http://frontend:5173'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 393, height: 850 } })

const content = async () => (await (await page.request.get(`${BASE}/api/admin/content`)).json())
const setVisible = (id, v) => page.request.put(`${BASE}/api/admin/sections/${id}`, { data: { is_visible: v } })
const original = (await content()).sections.map((s) => ({ id: s.id, is_visible: s.is_visible }))
for (const s of original) if (!s.is_visible) await setVisible(s.id, 1)

const targets = [
  ['hero', 'section.hero'],
  ['services', '#services'],
  ['about', '#about'],
  ['testimonials', '#testimonials'],
  ['cta', 'section:has(> div a[href="#calendar"]).py-20:not(#calendar)'],
  ['work', '#work'],
  ['calendar', '#calendar'],
  ['manage', '#manage-bookings, section:has(input[type="email"])'],
  ['footer', 'footer'],
]

try {
  for (const width of [393, 768]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2500)
    for (const [name, sel] of targets) {
      const loc = page.locator(sel).first()
      if (!(await loc.count())) { console.log(`skip ${name}@${width} (no match for ${sel})`); continue }
      try {
        await loc.screenshot({ path: `/app/tmp-e2e/r11-${width}-${name}.png` })
        const box = await loc.boundingBox()
        console.log(`${name}@${width} ${Math.round(box.width)}x${Math.round(box.height)}`)
      } catch (e) { console.log(`fail ${name}@${width}: ${e.message.slice(0, 80)}`) }
    }
  }
} finally {
  for (const s of original) await setVisible(s.id, s.is_visible)
}
await browser.close()
