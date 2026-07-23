import { computeSlots, getFreeBusy, getStubSlots, type BusyBlock } from '../../_lib/google-calendar'

export interface Env {
  BOOKING_CALENDAR_ID?: string
  PERSONAL_CALENDAR_ID?: string
  WORKING_HOURS_START?: string
  WORKING_HOURS_END?: string
  WORKING_DAYS?: string // "1,2,3,4,5"
  SLOT_DURATION_MINUTES?: string // "30"
  ENVIRONMENT?: string
  SITE_URL?: string
  GCAL_SERVICE_ACCOUNT_KEY?: string
  STUB?: string
  STUB_SLOTS?: string
}

function parseWorkingDays(raw?: string): number[] {
  if (!raw) return [1, 2, 3, 4, 5]
  try {
    return raw.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n >= 0 && n <= 6)
  } catch {
    return [1, 2, 3, 4, 5]
  }
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url)
    const weeksParam = url.searchParams.get('weeks')
    let weeks = 2
    if (weeksParam) {
      const parsed = parseInt(weeksParam, 10)
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 8) {
        weeks = parsed
      }
    }

    const workingHours = {
      start: env?.WORKING_HOURS_START || '09:00',
      end: env?.WORKING_HOURS_END || '17:00',
      days: parseWorkingDays(env?.WORKING_DAYS),
      slotMinutes: parseInt(env?.SLOT_DURATION_MINUTES || '30', 10) || 30,
    }

    // FreeBusy — stub when no SA key or ENVIRONMENT test/local or STUB flag
    const { busyBlocks, source, error } = await getFreeBusy(env)

    let slots
    if (source === 'stub' && busyBlocks.length === 0) {
      // For stub with no busy, generate full slots via getStubSlots
      slots = getStubSlots(weeks)
      // Filter by workingHours (stub uses same, but ensure)
      // Filter past slots for today
      const now = new Date()
      slots = slots.filter((s: any) => new Date(s.end) > now)
      // Filter by working days already done in getStubSlots
      // No event details (privacy) — stub already has no titles
    } else {
      const startDate = new Date()
      startDate.setUTCHours(0, 0, 0, 0)
      slots = (await import('../../_lib/google-calendar')).computeSlots({
        startDate,
        weeks,
        workingHours,
        busyBlocks,
      })
      // Filter past
      const now = new Date()
      slots = slots.filter((s: any) => new Date(s.end) > now)
    }

    // Ensure no event details leaked (privacy per 6.2)
    const safeSlots = slots.map((s: any) => ({
      date: s.date,
      start: s.start,
      end: s.end,
      available: s.available,
      // No title, summary, description, attendees
    }))

    return new Response(
      JSON.stringify({
        slots: safeSlots,
        weeks,
        source, // stub or live — for debugging, UI can show badge
        error: error || undefined,
        calendars: {
          booking: env?.BOOKING_CALENDAR_ID ? 'configured' : 'not-configured',
          personal: env?.PERSONAL_CALENDAR_ID ? 'configured' : 'not-configured',
        },
        workingHours,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300', // 5-min TTL per design 6.2 / 9.1
          'Access-Control-Allow-Origin': '*',
          'X-Cache': source === 'live' ? 'MISS' : 'STUB', // For test: should have cache-control, X-Cache defined
          'X-Content-Source': source,
        },
      }
    )
  } catch (e: any) {
    // Fallback to stub on error
    const fallbackSlots = getStubSlots(2)
    return new Response(
      JSON.stringify({
        slots: fallbackSlots,
        weeks: 2,
        source: 'stub',
        error: e?.message || String(e),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
          'Access-Control-Allow-Origin': '*',
          'X-Cache': 'FALLBACK',
        },
      }
    )
  }
}
