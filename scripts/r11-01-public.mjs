/**
 * Round 11 — public site sweep at 1440 / 768 / 393 with every section published.
 * Restores the original visibility in a finally block.
 */
import { chromium } from 'playwright'

const BASE = 'http://frontend:5173'
const out = []
const check = (name, pass, detail = '') => {
  out.push(pass)
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const consoleErrors = []
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))

const content = async () => (await (await page.request.get(`${BASE}/api/admin/content`)).json())
const setVisible = (id, v) => page.request.put(`${BASE}/api/admin/sections/${id}`, { data: { is_visible: v } })

const original = (await content()).sections.map((s) => ({ id: s.id, is_visible: s.is_visible }))
for (const s of original) if (!s.is_visible) await setVisible(s.id, 1)

try {
  for (const width of [1440, 768, 393]) {
    await page.setViewportSize({ width, height: width === 393 ? 850 : 1000 })
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2500)
    await page.screenshot({ path: `/app/tmp-e2e/r11-public-${width}-full.png`, fullPage: true })
    await page.screenshot({ path: `/app/tmp-e2e/r11-public-${width}-top.png` })

    // Horizontal overflow
    const overflow = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      offenders: [...document.querySelectorAll('body *')]
        .filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 2)
        .slice(0, 5)
        .map((el) => `${el.tagName}.${(el.className || '').toString().slice(0, 40)} right=${Math.round(el.getBoundingClientRect().right)}`),
    }))
    check(`no horizontal overflow at ${width}`, overflow.scrollW <= overflow.clientW + 1, JSON.stringify(overflow))

    // Nav landmarks
    const landmarks = await page.evaluate(() => {
      const header = document.querySelector('header')
      const nav = header?.querySelector('nav')
      return {
        headerExists: !!header,
        navInsideHeader: !!nav,
        navLabel: nav?.getAttribute('aria-label') || null,
        badRoles: [...document.querySelectorAll('[role="banner"],[role="navigation"]')].map((e) => `${e.tagName}[role=${e.getAttribute('role')}]`),
        headerCount: document.querySelectorAll('header').length,
        navCount: document.querySelectorAll('nav').length,
        h1Count: document.querySelectorAll('h1').length,
      }
    })
    check(`nav landmarks at ${width}`, landmarks.headerExists && landmarks.navInsideHeader && landmarks.navLabel === 'Main navigation' && landmarks.badRoles.length === 0, JSON.stringify(landmarks))
    check(`exactly one h1 at ${width}`, landmarks.h1Count === 1, `h1=${landmarks.h1Count}`)

    // Duplicate ids
    const dupIds = await page.evaluate(() => {
      const seen = {}, dups = []
      document.querySelectorAll('[id]').forEach((el) => { seen[el.id] = (seen[el.id] || 0) + 1 })
      for (const [k, v] of Object.entries(seen)) if (v > 1) dups.push(`${k}x${v}`)
      return dups
    })
    check(`no duplicate element ids at ${width}`, dupIds.length === 0, dupIds.join(','))

    // Anchor targets all exist
    const anchors = await page.evaluate(() =>
      [...document.querySelectorAll('a[href^="#"]')].map((a) => ({
        href: a.getAttribute('href'),
        exists: !!document.querySelector(a.getAttribute('href')),
        text: a.textContent.trim().slice(0, 24),
      })),
    )
    const broken = anchors.filter((a) => !a.exists && a.href !== '#')
    check(`every in-page link has a target at ${width}`, broken.length === 0, JSON.stringify(broken))

    // Tap target sizes for interactive elements
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('a,button,input,select,textarea')]
        .filter((el) => {
          const r = el.getBoundingClientRect()
          const st = getComputedStyle(el)
          return r.width > 0 && st.visibility !== 'hidden' && st.display !== 'none' && (r.height < 40 || r.width < 24)
        })
        .map((el) => `${el.tagName} "${el.textContent.trim().slice(0, 20)}" ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`),
    )
    check(`interactive targets >= ~44px tall at ${width}`, small.length === 0, small.slice(0, 8).join(' | '))
  }

  // ---- Mobile nav menu -------------------------------------------------------
  await page.setViewportSize({ width: 393, height: 850 })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  const menuBtn = page.locator('button[aria-label="Open menu"]')
  check('hamburger appears at 393', await menuBtn.count() === 1)
  if (await menuBtn.count()) {
    await menuBtn.click()
    await page.waitForTimeout(400)
    await page.screenshot({ path: '/app/tmp-e2e/r11-public-393-menu.png' })
    const items = await page.locator('nav .absolute a').allTextContents()
    check('menu lists the section links', items.length >= 2, items.join(','))
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    check('Escape closes the mobile menu', await page.locator('nav .absolute a').count() === 0)
    await menuBtn.click()
    await page.waitForTimeout(300)
    await page.mouse.click(200, 700)
    await page.waitForTimeout(300)
    check('outside click closes the mobile menu', await page.locator('nav .absolute a').count() === 0)
    // clicking a menu item navigates
    await menuBtn.click()
    await page.waitForTimeout(300)
    const first = page.locator('nav .absolute a').first()
    const href = await first.getAttribute('href')
    await first.click()
    await page.waitForTimeout(900)
    const scrolled = await page.evaluate(() => window.scrollY)
    check(`menu link ${href} scrolls the page`, scrolled > 100, `scrollY=${scrolled}`)
    await page.screenshot({ path: '/app/tmp-e2e/r11-public-393-after-navlink.png' })
  }

  // ---- Desktop nav CTA -------------------------------------------------------
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  await page.locator('nav a[href="#calendar"]').first().click()
  await page.waitForTimeout(1200)
  const calTop = await page.evaluate(() => document.getElementById('calendar').getBoundingClientRect().top)
  check('“Book a free call” scrolls the calendar into view', Math.abs(calTop) < 200, `calendar top=${Math.round(calTop)}`)
  await page.screenshot({ path: '/app/tmp-e2e/r11-public-1440-calendar.png' })

  check('no console errors on the public page', consoleErrors.length === 0, consoleErrors.slice(0, 4).join(' | '))
} finally {
  for (const s of original) await setVisible(s.id, s.is_visible)
  console.log('restored visibility:', JSON.stringify(original))
}

console.log(`\n${out.filter(Boolean).length}/${out.length} passed`)
await browser.close()
