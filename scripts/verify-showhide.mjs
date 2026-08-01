/** Hide → Show round-trips on the correct section, scoped to that section's own card. */
import { chromium } from 'playwright'
const BASE = process.env.BASE_URL || 'http://frontend:5173'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
await p.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
await p.waitForTimeout(800)

const api = async () => (await (await p.request.get(`${BASE}/api/admin/content`)).json()).sections
const target = (await api()).find((s) => s.is_visible === 1 && s.type === 'text-block')
const card = p.locator('[data-section]').filter({ hasText: target.heading }).first()

await card.getByRole('button', { name: 'Hide section' }).click()
await p.waitForTimeout(900)
const hidden = (await api()).find((s) => s.id === target.id).is_visible

await card.getByRole('button', { name: 'Show section' }).click()
await p.waitForTimeout(900)
const shown = (await api()).find((s) => s.id === target.id).is_visible

await b.close()
const ok = hidden === 0 && shown === 1
console.log(`${ok ? 'PASS' : 'FAIL'}  hide -> ${hidden}, show -> ${shown} (expected 0 then 1)`)
process.exit(ok ? 0 : 1)
