import { chromium } from 'playwright'
import { makePng } from '/app/scripts/lib/testPng.mjs'

const BASE = process.env.BASE_URL || 'http://frontend:5173'
// 1200x900, which is what the hero slot renders. An 8x8 fixture used to be enough here,
// but the uploader now refuses images too small for the slot they land in — that check
// exists because an 8x8 upload really did ship as a red block across the live hero.
const REAL_PNG = makePng(1200, 900)
const TINY_PNG = makePng(8, 8)

const b = await chromium.launch()
const p = await b.newPage()
await p.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
const input = p.locator('input[type="file"]').first()

// 1: a real image keeps its real pixels and its real dimensions
const resp = p.waitForResponse((r) => r.url().includes('/api/admin/upload-image'), { timeout: 20000 })
await input.setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: REAL_PNG })
const body = await (await resp).json()
const px = await p.evaluate(async (url) => {
  const img = new Image()
  img.src = url
  await img.decode()
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  c.getContext('2d').drawImage(img, 0, 0)
  const d = c.getContext('2d').getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data
  return { w: img.naturalWidth, h: img.naturalHeight, center: [d[0], d[1], d[2]] }
}, body.url)
console.log('stored image:', JSON.stringify(px))
// The fixture's midpoint is a mid grey-blue, not the white a blank canvas would give.
const notBlank = px.center.some((c) => c < 240) && px.center.some((c) => c > 15)
console.log(notBlank ? 'PASS real pixels preserved' : `FAIL blank/wrong colour ${px.center}`)
console.log(px.w === 1200 && px.h === 900 ? 'PASS real dimensions kept (1200x900, no upscale)' : `FAIL dimensions ${px.w}x${px.h}`)

// 2: an image too small for the slot is refused before it reaches R2
let uploaded = false
p.on('response', (r) => { if (r.url().includes('/api/admin/upload-image')) uploaded = true })
uploaded = false
await input.setInputFiles({ name: 'favicon.png', mimeType: 'image/png', buffer: TINY_PNG })
await p.waitForTimeout(2500)
const warned = await p.getByText(/only 8px wide/i).count()
console.log(warned > 0 ? 'PASS an undersized image is refused with a readable reason' : 'FAIL no warning for an 8px image')
console.log(!uploaded ? 'PASS the undersized image never reached storage' : 'FAIL it was uploaded anyway')

await b.close()
process.exit(notBlank && px.w === 1200 && warned > 0 && !uploaded ? 0 : 1)
