import { chromium } from 'playwright'
const BASE = process.env.BASE_URL || 'http://frontend:5173'
const RED8 = 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC'
const b = await chromium.launch(); const p = await b.newPage()
await p.goto(`${BASE}/admin`, {waitUntil:'networkidle'})
const input = p.locator('input[type="file"]').first()

// 1: a real image keeps its real pixels and its real dimensions
const resp = p.waitForResponse(r => r.url().includes('/api/admin/upload-image'), {timeout:20000})
await input.setInputFiles({name:'red.png', mimeType:'image/png', buffer: Buffer.from(RED8,'base64')})
const body = await (await resp).json()
const px = await p.evaluate(async (url) => {
  const img = new Image(); img.src = url; await img.decode()
  const c = document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight
  c.getContext('2d').drawImage(img,0,0)
  const d = c.getContext('2d').getImageData(Math.floor(c.width/2), Math.floor(c.height/2),1,1).data
  return { w:img.naturalWidth, h:img.naturalHeight, center:[d[0],d[1],d[2]] }
}, body.url)
console.log('stored image:', JSON.stringify(px))
console.log(px.center[0]>200 && px.center[1]<80 ? 'PASS real pixels preserved' : 'FAIL blank/wrong colour')
console.log(px.w===8 && px.h===8 ? 'PASS real dimensions kept (8x8, no upscale)' : `FAIL dimensions ${px.w}x${px.h}`)

// Note: the error path for undecodable files is covered by verify-undecodable.mjs —
// a merely CRC-corrupt PNG is still readable by the browser's <img> decoder, so it
// legitimately uploads.

await b.close()
