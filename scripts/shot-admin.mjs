/** Crops of the admin previews, plus icon-tile geometry inside the services card. */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://frontend:5173'
const TAG = process.env.TAG || 'now'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })

const sections = async () => (await (await page.request.get(`${BASE}/api/admin/content`)).json()).sections
const setVisible = (id, v) => page.request.put(`${BASE}/api/admin/sections/${id}`, { data: { is_visible: v } })
const original = (await sections()).map((s) => ({ id: s.id, is_visible: s.is_visible }))
for (const s of original) if (!s.is_visible) await setVisible(s.id, 1)

try {
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  const cards = page.locator('[data-section]')
  const n = await cards.count()
  for (let i = 0; i < n; i++) {
    const label = (await cards.nth(i).locator('span,h2').first().textContent())?.slice(0, 18).replace(/\W+/g, '-')
    await cards.nth(i).screenshot({ path: `/app/tmp-e2e/${TAG}-adm-${i}-${label}.png` })
  }
  const geom = await page.evaluate(() => {
    const card = [...document.querySelectorAll('[data-section]')].find((c) => /Services/.test(c.textContent))
    if (!card) return 'no services card'
    return [...card.querySelectorAll('.card')].map((c) => {
      const tile = c.querySelector('div.w-12')
      const cr = c.getBoundingClientRect()
      const tr = tile?.getBoundingClientRect()
      const g = tile?.firstElementChild?.getBoundingClientRect()
      return {
        text: c.textContent.slice(0, 20),
        tileTop: tr ? Math.round(tr.top - cr.top) : null,
        tileH: tr ? Math.round(tr.height) : null,
        glyphW: g ? Math.round(g.width) : null,
        dx: g && tr ? Math.round(g.left + g.width / 2 - (tr.left + tr.width / 2)) : null,
        dy: g && tr ? Math.round(g.top + g.height / 2 - (tr.top + tr.height / 2)) : null,
      }
    })
  })
  console.log('ADMIN SERVICE ICONS', JSON.stringify(geom, null, 1))
} finally {
  for (const s of original) await setVisible(s.id, s.is_visible)
}
await browser.close()
