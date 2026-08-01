/**
 * Verifies the eight blockers raised in the third UI/UX review.
 * docker run --rm --network profile-webapp_portfolio-net -v "$PWD":/app -w /tmp/pw \
 *   mcr.microsoft.com/playwright:v1.50.0-noble sh -c "... node verify-uiux-round3.mjs"
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
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)

// 6 — the hero's primary CTA must land somewhere -----------------------------
const heroCta = page.locator('.hero a.btn-primary').first()
const heroHref = await heroCta.getAttribute('href')
const heroTargetExists = await page.evaluate((h) => !h.startsWith('#') || Boolean(document.querySelector(h)), heroHref)
check('hero primary CTA points at a section that exists', heroTargetExists, `${await heroCta.innerText()} -> ${heroHref}`)

const dead = await page.$$eval('a[href^="#"]', (els) =>
  els.filter((e) => e.getAttribute('href') !== '#' && !document.querySelector(e.getAttribute('href')))
     .map((e) => `${e.textContent.trim()} -> ${e.getAttribute('href')}`))
check('no dead in-page anchors anywhere on /', dead.length === 0, dead.join(' | '))

// 7 — keyboard focus is visible on the booking controls -----------------------
const ringOf = async (locator) => {
  await locator.evaluate((e) => e.focus())
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  return page.evaluate(() => {
    const s = getComputedStyle(document.activeElement)
    return { tag: document.activeElement.tagName, outline: s.outlineWidth, shadow: s.boxShadow }
  })
}
const dayRing = await ringOf(page.locator('button[aria-label*="slots available"]').first())
check('calendar day buttons show a keyboard focus ring', dayRing.outline !== '0px' || dayRing.shadow !== 'none', JSON.stringify(dayRing))
const ctaRing = await ringOf(heroCta)
check('hero CTA shows a keyboard focus ring', ctaRing.outline !== '0px' || ctaRing.shadow !== 'none', JSON.stringify(ctaRing))

// 1 + 8 — the booking flow -----------------------------------------------------
const calendarBox = await page.locator('.card').filter({ hasText: 'Available times' }).first().boundingBox()
await page.locator('button[aria-label*="slots available"]').first().click()
await page.waitForTimeout(900)
const pickerBox = await page.locator('#slot-picker .card').first().boundingBox()
check('slot picker shares the calendar card edges', Math.abs(pickerBox.x - calendarBox.x) <= 2 && Math.abs(pickerBox.width - calendarBox.width) <= 2,
  `picker ${Math.round(pickerBox.x)}+${Math.round(pickerBox.width)} vs calendar ${Math.round(calendarBox.x)}+${Math.round(calendarBox.width)}`)

const slotButton = page.locator('#slot-picker button').filter({ hasText: /AM|PM/ }).first()
const slotLabel = await slotButton.innerText()
check('time slots keep AM/PM', /AM|PM/.test(slotLabel), slotLabel)
await slotButton.click()
await page.waitForTimeout(700)

const formText = await page.locator('#slot-picker').innerText()
const jargon = ['Turnstile', 'Resend', 'conferenceData', 'FreeBusy', 'Anti-bot', 'Meet link auto', 'rate limit', 'America/New_York', 'stub', '/api/']
check('booking form has no vendor or spec jargon', jargon.every((j) => !formText.includes(j)),
  jargon.filter((j) => formText.includes(j)).join(' | '))
check('booking form title is a readable date, not an ISO string', !/\d{4}-\d{2}-\d{2}/.test(formText),
  (formText.match(/\d{4}-\d{2}-\d{2}[^\n]*/) || [''])[0])
const formBox = await page.locator('#slot-picker form').first().boundingBox()
check('booking form is centred under the calendar', Math.abs((formBox.x + formBox.width / 2) - (calendarBox.x + calendarBox.width / 2)) <= 2,
  `form centre ${Math.round(formBox.x + formBox.width / 2)} vs ${Math.round(calendarBox.x + calendarBox.width / 2)}`)

// 2 — the spam check must never leave a control dead with no explanation -------
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(11500)
const lookupState = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => /Find my bookings/.test(b.textContent))
  const alert = [...document.querySelectorAll('[role="alert"]')].map((e) => e.textContent.trim())
  return { disabled: btn?.disabled, alerts: alert }
})
check('a failed spam check is explained with a retry, not silence',
  !lookupState.disabled || lookupState.alerts.some((a) => /spam check/i.test(a)),
  JSON.stringify(lookupState).slice(0, 160))

// 3 — the calendar fits its cells at 393px ------------------------------------
await page.setViewportSize({ width: 393, height: 852 })
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const spill = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('button[aria-label]')].filter((b) => /^(SUN|MON|TUE|WED|THU|FRI|SAT) /.test(b.getAttribute('aria-label').toUpperCase()))
  return cells.flatMap((cell) => {
    const c = cell.getBoundingClientRect()
    return [...cell.querySelectorAll('*')]
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && (r.left < c.left - 0.5 || r.right > c.right + 0.5))
      .map(({ el, r }) => `${el.textContent.trim()} ${Math.round(r.width)}px in ${Math.round(c.width)}px cell`)
  })
})
check('nothing overflows a calendar day cell @393', spill.length === 0, spill.slice(0, 4).join(' | '))
await page.screenshot({ path: '/app/tmp-e2e/round3-cal-393.png' })

// 4 + 5 — the admin ------------------------------------------------------------
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
const overlaps = await page.evaluate(() => {
  const controls = [...document.querySelectorAll('button[aria-label^="Move section"], button[aria-label$="section"]')]
  const headings = [...document.querySelectorAll('h1, h2, h3')]
  const hit = []
  for (const c of controls) {
    const a = c.getBoundingClientRect()
    for (const h of headings) {
      const b = h.getBoundingClientRect()
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
      const t = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
      if (w > 1 && t > 1) hit.push(`${c.getAttribute('aria-label')} x "${h.textContent.trim().slice(0, 20)}"`)
    }
  }
  return hit
})
check('admin controls never overlap a heading @393', overlaps.length === 0, overlaps.slice(0, 4).join(' | '))
const visibleWithoutHover = await page.evaluate(() =>
  [...document.querySelectorAll('button[aria-label="Hide section"], button[aria-label="Show section"]')]
    .every((b) => getComputedStyle(b).opacity === '1' && b.getBoundingClientRect().width > 0))
check('admin section controls are visible without hovering', visibleWithoutHover)

await page.setViewportSize({ width: 1440, height: 1000 })
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(700)
await page.getByRole('button', { name: /Edit Hero heading/i }).first().click()
await page.waitForTimeout(400)
const chrome = await page.evaluate(() => {
  const hint = [...document.querySelectorAll('span')].find((s) => /to save · Esc to cancel/.test(s.textContent))
  const save = [...document.querySelectorAll('button[aria-label="Save"]')][0]
  const read = (el) => {
    const s = getComputedStyle(el)
    return { family: s.fontFamily.split(',')[0].replace(/"/g, ''), size: parseFloat(s.fontSize), tracking: s.letterSpacing }
  }
  return { hint: hint && read(hint), save: save && read(save) }
})
check('editor hint uses the UI face, not the heading serif', chrome.hint?.family === 'Inter', JSON.stringify(chrome.hint))
check('editor hint has normal tracking and is >= 11px', chrome.hint?.tracking === 'normal' && chrome.hint?.size >= 11, JSON.stringify(chrome.hint))
check('editor buttons use the UI face', chrome.save?.family === 'Inter', JSON.stringify(chrome.save))
await page.keyboard.press('Escape')

const editHint = await page.evaluate(() => {
  const el = [...document.querySelectorAll('span')].find((s) => s.textContent.trim() === '✎ Edit')
  if (!el) return null
  const s = getComputedStyle(el)
  return { family: s.fontFamily.split(',')[0].replace(/"/g, ''), tracking: s.letterSpacing }
})
check('the "✎ Edit" marker uses the UI face', editHint?.family === 'Inter' && editHint?.tracking === 'normal', JSON.stringify(editHint))

check('page titles are descriptive', (await page.title()) !== 'Portfolio', await page.title())
await page.screenshot({ path: '/app/tmp-e2e/round3-admin.png', fullPage: true })

await browser.close()
const failed = out.filter((p) => !p).length
console.log(`\n${out.length - failed}/${out.length} checks passed`)
process.exit(failed ? 1 : 0)
