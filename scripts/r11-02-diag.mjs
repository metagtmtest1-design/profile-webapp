/**
 * Round 11 — identify the 400 responses on the public page and check the skip link.
 */
import { chromium } from 'playwright'

const BASE = 'http://frontend:5173'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })

const failures = []
page.on('response', (r) => { if (r.status() >= 400) failures.push(`${r.status()} ${r.request().resourceType()} ${r.url()}`) })

const content = async () => (await (await page.request.get(`${BASE}/api/admin/content`)).json())
const setVisible = (id, v) => page.request.put(`${BASE}/api/admin/sections/${id}`, { data: { is_visible: v } })
const original = (await content()).sections.map((s) => ({ id: s.id, is_visible: s.is_visible }))
for (const s of original) if (!s.is_visible) await setVisible(s.id, 1)

try {
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  console.log('--- failing requests ---')
  for (const f of [...new Set(failures)]) console.log(f)

  // Are any images broken on screen?
  const imgs = await page.evaluate(() =>
    [...document.querySelectorAll('img')].map((i) => ({
      src: i.currentSrc || i.src,
      natural: `${i.naturalWidth}x${i.naturalHeight}`,
      rendered: `${Math.round(i.getBoundingClientRect().width)}x${Math.round(i.getBoundingClientRect().height)}`,
      alt: i.alt,
    })),
  )
  console.log('--- images ---')
  for (const i of imgs) console.log(`${i.natural} rendered ${i.rendered} alt="${i.alt}" ${i.src.slice(0, 100)}`)
  const brokenImgs = imgs.filter((i) => i.natural === '0x0')
  console.log(`broken images: ${brokenImgs.length}`)

  // Skip link on focus
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.keyboard.press('Tab')
  await page.waitForTimeout(300)
  const skip = await page.evaluate(() => {
    const el = document.activeElement
    const r = el.getBoundingClientRect()
    return { tag: el.tagName, text: el.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), left: Math.round(r.left), outline: getComputedStyle(el).outline }
  })
  console.log('--- first Tab stop ---', JSON.stringify(skip))
  await page.screenshot({ path: '/app/tmp-e2e/r11-skiplink-focus.png', clip: { x: 0, y: 0, width: 700, height: 200 } })
  await page.keyboard.press('Enter')
  await page.waitForTimeout(800)
  const afterSkip = await page.evaluate(() => ({ hash: location.hash, active: document.activeElement.tagName + '#' + document.activeElement.id, scrollY: window.scrollY }))
  console.log('--- after Enter on skip link ---', JSON.stringify(afterSkip))

  // Full keyboard tab order across the top of the page
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  const order = []
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab')
    order.push(await page.evaluate(() => {
      const el = document.activeElement
      const r = el.getBoundingClientRect()
      const st = getComputedStyle(el)
      return `${el.tagName}"${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 26)}" vis=${r.width > 0 && r.height > 0} outline=${st.outlineWidth} ring=${st.boxShadow.slice(0, 24)}`
    }))
  }
  console.log('--- tab order ---')
  order.forEach((o, i) => console.log(`${i + 1}. ${o}`))
  await page.screenshot({ path: '/app/tmp-e2e/r11-focus-ring.png' })
} finally {
  for (const s of original) await setVisible(s.id, s.is_visible)
}
await browser.close()
