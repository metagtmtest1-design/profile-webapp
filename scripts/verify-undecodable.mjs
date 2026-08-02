import { chromium } from 'playwright'
const BASE = process.env.BASE_URL || 'http://frontend:5173'
const b = await chromium.launch(); const p = await b.newPage()
await p.goto(`${BASE}/admin`, {waitUntil:'networkidle'})
const input = p.locator('input[type="file"]').first()
let uploaded = false
p.on('request', r => { if (r.url().includes('/api/admin/upload-image')) uploaded = true })
// Bytes that no image decoder can read, presented with an image mime type
await input.setInputFiles({name:'photo.heic', mimeType:'image/heic', buffer: Buffer.from('not an image at all, just text bytes')})
await p.waitForTimeout(3000)
const err = await p.getByText(/Could not read this image/i).count()
console.log(err>0 ? 'PASS clear error shown to the user' : 'FAIL no error shown')
console.log(!uploaded ? 'PASS nothing was uploaded to R2' : 'FAIL a blank image was uploaded anyway')
await p.screenshot({path:'/app/tmp-e2e/x-undecodable.png'})
await b.close()
