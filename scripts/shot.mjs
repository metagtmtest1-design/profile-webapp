/**
 * Ad-hoc screenshotter. Shows every section for the duration of the run, captures
 * the public page and the admin, then restores the original visibility.
 * docker run --rm --network profile-webapp_portfolio-net -v "$PWD":/app -w /tmp/pw \
 *   mcr.microsoft.com/playwright:v1.50.0-noble sh -c "cp /app/scripts/shot.mjs . && node shot.mjs"
 */
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
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `/app/tmp-e2e/${TAG}-public-full.png`, fullPage: true })
  const svc = await page.$('#services')
  if (svc) await svc.screenshot({ path: `/app/tmp-e2e/${TAG}-public-services.png` })
  const tst = await page.$('#testimonials')
  if (tst) await tst.screenshot({ path: `/app/tmp-e2e/${TAG}-public-testimonials.png` })
  const hero = await page.$('.hero')
  if (hero) await hero.screenshot({ path: `/app/tmp-e2e/${TAG}-public-hero.png` })

  // Where does each service icon tile sit, and does it line up with its row-mates?
  const icons = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#services .card')]
    return cards.map((c) => {
      const tile = c.querySelector('div.w-12')
      const title = c.querySelector('h3')
      const cr = c.getBoundingClientRect()
      const tr = tile?.getBoundingClientRect()
      const hr = title?.getBoundingClientRect()
      const glyph = tile?.querySelector('span')
      const gr = glyph?.getBoundingClientRect()
      return {
        title: title?.textContent,
        tileTopWithinCard: tr ? Math.round(tr.top - cr.top) : null,
        titleTopWithinCard: hr ? Math.round(hr.top - cr.top) : null,
        glyphW: gr ? Math.round(gr.width) : null,
        glyphH: gr ? Math.round(gr.height) : null,
        glyphCentreOffsetX: gr && tr ? Math.round(gr.left + gr.width / 2 - (tr.left + tr.width / 2)) : null,
        glyphCentreOffsetY: gr && tr ? Math.round(gr.top + gr.height / 2 - (tr.top + tr.height / 2)) : null,
      }
    })
  })
  console.log('SERVICE ICONS', JSON.stringify(icons, null, 1))

  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `/app/tmp-e2e/${TAG}-admin-full.png`, fullPage: true })
} finally {
  for (const s of original) await setVisible(s.id, s.is_visible)
}

await browser.close()
