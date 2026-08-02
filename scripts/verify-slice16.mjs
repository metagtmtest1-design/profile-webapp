/**
 * Pins the three problems reported after the slice-15 review:
 *   1. the hero button advertised "Explore Services", a section the landing page does not show
 *   2. the service icons did not line up with each other
 *   3. the testimonial stars were five hardcoded characters with no way to change them
 *
 * Shows every section for the duration of the run and restores visibility afterwards.
 * docker run --rm --network profile-webapp_portfolio-net -v "$PWD":/app -w /tmp/pw \
 *   mcr.microsoft.com/playwright:v1.50.0-noble sh -c "npm i -s playwright@1.50.0 && cp /app/scripts/verify-slice16.mjs . && node verify-slice16.mjs"
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://frontend:5173'
const out = []
const check = (name, pass, detail = '') => {
  out.push(pass)
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })

const sections = async () => (await (await page.request.get(`${BASE}/api/admin/content`)).json()).sections
const setVisible = (id, v) => page.request.put(`${BASE}/api/admin/sections/${id}`, { data: { is_visible: v } })
const original = (await sections()).map((s) => ({ id: s.id, is_visible: s.is_visible }))
for (const s of original) if (!s.is_visible) await setVisible(s.id, 1)

// Restored in the finally block — the run must not leave the owner's content edited.
const before = await sections()
const testimonials = before.find((s) => s.type === 'testimonials')
const services = before.find((s) => s.type === 'cards-grid')
const heroItem = before.find((s) => s.type === 'hero').items[0]
const victim = testimonials.items[0]
const svcVictim = services.items[0]
const restore = []

try {
  // 1 — the hero button names something the page actually has ---------------------
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  const heroCta = await page.evaluate(() => {
    const a = document.querySelector('.hero a')
    if (!a) return null
    return { text: a.textContent.replace(/→/g, '').trim(), href: a.getAttribute('href') }
  })
  const anchorExists = heroCta?.href?.includes('#')
    ? await page.evaluate((h) => !!document.getElementById(h.slice(h.indexOf('#') + 1)), heroCta.href)
    : true
  check('the hero button points at a section that is on the page', anchorExists, JSON.stringify(heroCta))

  // The label must name something the visitor can see, not a heading that was renamed
  // or a section that was hidden. Booking is always present, hence the allowance.
  const headings = await page.$$eval('h1,h2,h3', (els) => els.map((e) => e.textContent.trim().toLowerCase()))
  const label = (heroCta?.text || '').toLowerCase()
  const namesSomethingReal = /book|call|contact|talk|get in touch/.test(label) || headings.some((h) => h.includes(label) || label.includes(h))
  check('the hero button label matches what the page offers', namesSomethingReal, `"${heroCta?.text}"`)

  // The stale fallback is the thing that produced "Explore Services" in the first place.
  const fallback = await (await page.request.get(`${BASE}/api/content/home`)).json()
  const fallbackHero = fallback.sections.find((s) => s.type === 'hero')?.items?.[0]
  check('no served hero item still says "Explore Services"', !/Explore Services/i.test(fallbackHero?.link_text || ''), fallbackHero?.link_text)

  // 2 — service icons line up ------------------------------------------------------
  const iconGeom = async () =>
    page.evaluate(() => {
      const cards = [...document.querySelectorAll('#services .card')]
      return cards.map((c) => {
        const tile = c.querySelector('div.w-12')
        const cr = c.getBoundingClientRect()
        const tr = tile.getBoundingClientRect()
        const g = tile.firstElementChild.getBoundingClientRect()
        return {
          top: Math.round(tr.top),
          topInCard: Math.round(tr.top - cr.top),
          overflowsTile: g.left < tr.left - 1 || g.right > tr.right + 1,
          dx: Math.round(g.left + g.width / 2 - (tr.left + tr.width / 2)),
        }
      })
    })

  let geom = await iconGeom()
  const rowTops = [...new Set(geom.map((g) => g.top))]
  check('every icon tile sits at the same height within its card', new Set(geom.map((g) => g.topInCard)).size === 1, JSON.stringify(geom.map((g) => g.topInCard)))
  check('icons form clean rows, not a staircase', rowTops.length <= Math.ceil(geom.length / 3), `${rowTops.length} distinct tops`)
  check('no glyph spills outside its tile', geom.every((g) => !g.overflowsTile && Math.abs(g.dx) <= 1), JSON.stringify(geom.map((g) => g.dx)))

  // The row used to break the moment one card had an image and its siblings did not.
  restore.push(() => page.request.put(`${BASE}/api/admin/items/${svcVictim.id}`, { data: { image_url: svcVictim.image_url ?? null } }))
  await page.request.put(`${BASE}/api/admin/items/${svcVictim.id}`, {
    data: { image_url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop' },
  })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  geom = await iconGeom()
  const firstRow = geom.slice(0, 3).map((g) => g.top)
  check('one card gaining an image does not drop its icon below its row-mates', new Set(firstRow).size === 1, JSON.stringify(firstRow))

  // 3 — the star rating is real, editable data --------------------------------------
  restore.push(() => page.request.put(`${BASE}/api/admin/items/${victim.id}`, { data: { rating: victim.rating ?? 5 } }))

  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  const star = page.getByRole('button', { name: /Rate .* 2 out of 5 stars/ }).first()
  check('the admin offers a star control on each testimonial', (await page.getByRole('button', { name: /Rate .* out of 5 stars/ }).count()) >= 5)
  await star.click()
  await page.waitForTimeout(1200)

  const stored = (await sections()).find((s) => s.type === 'testimonials').items.find((i) => i.id === victim.id)
  check('clicking a star writes the rating through to the database', stored?.rating === 2, `stored ${stored?.rating}`)

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  check('the live page draws the rating the owner set', (await page.getByRole('img', { name: 'Rated 2 out of 5' }).count()) >= 1)
  check('the other testimonials keep their own rating', (await page.getByRole('img', { name: 'Rated 5 out of 5' }).count()) >= 1)

  const bad = await page.request.put(`${BASE}/api/admin/items/${victim.id}`, { data: { rating: 9 } })
  check('the API refuses a rating outside 1–5', bad.status() === 400, `status ${bad.status()}`)
} finally {
  for (const r of restore) await r()
  for (const s of original) await setVisible(s.id, s.is_visible)
}

await browser.close()
const failed = out.filter((p) => !p).length
console.log(`\n${out.length - failed}/${out.length} checks passed`)
process.exit(failed ? 1 : 0)
