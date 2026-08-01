/** The "Hidden" badge must not collide with the section controls on a narrow screen. */
import { chromium } from 'playwright'
const BASE = process.env.BASE_URL || 'http://frontend:5173'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 393, height: 852 } })
await p.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
await p.waitForTimeout(1000)

const res = await p.evaluate(() => {
  const out = []
  for (const badge of document.querySelectorAll('span')) {
    if (!/Hidden — not on live site/.test(badge.textContent)) continue
    const card = badge.closest('[data-section]')
    const cluster = card?.querySelector('[aria-label="Delete section"]')?.parentElement
    if (!cluster) continue
    const a = badge.getBoundingClientRect()
    const c = cluster.getBoundingClientRect()
    out.push({
      overlap: !(a.right < c.left || c.right < a.left || a.bottom < c.top || c.bottom < a.top),
      badge: [Math.round(a.left), Math.round(a.right)],
      cluster: [Math.round(c.left), Math.round(c.right)],
    })
  }
  return out
})

await b.close()
console.log(JSON.stringify(res, null, 1))
const bad = res.some((r) => r.overlap)
console.log(bad ? 'FAIL badge overlaps controls on mobile' : `PASS no overlap (${res.length} hidden sections checked)`)
process.exit(bad ? 1 : 0)
