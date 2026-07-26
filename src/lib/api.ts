export interface HealthResponse {
  status: 'ok' | 'error' | 'degraded'
  db: 'ok' | 'error'
  r2: 'ok' | 'error'
  timestamp: string
  env: string
  checks?: {
    d1Ms: number
    r2Ms: number
  }
  dbError?: string
  r2Error?: string
  sampleImageUrl?: string
}

export interface Page {
  id: string
  slug: string
  title: string
  meta_description?: string | null
  sort_order: number
  is_published: number
}

export interface SectionItem {
  id: string
  section_id: string
  title?: string | null
  body?: string | null
  image_url?: string | null
  icon?: string | null
  link_url?: string | null
  link_text?: string | null
  author?: string | null
  sort_order: number
  is_visible: number
}

export interface Section {
  id: string
  page_id: string
  type: 'hero' | 'cards-grid' | 'testimonials' | 'text-block' | 'cta-banner' | 'image-gallery'
  heading?: string | null
  subheading?: string | null
  sort_order: number
  config: any
  is_visible: number
  items: SectionItem[]
}

export interface ContentResponse {
  page: Page
  sections: Section[]
}

export class ApiError extends Error {
  status: number
  body?: any
  constructor(message: string, status: number, body?: any) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export interface FetchOptions {
  timeoutMs?: number
  signal?: AbortSignal
  cache?: RequestCache
}

async function fetchJson(url: string, options: FetchOptions & { method?: string } = {}) {
  const { timeoutMs = 5000, signal, method = 'GET', cache } = options as any
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs)
  if (signal) {
    signal.addEventListener('abort', () => controller.abort(signal.reason))
  }
  try {
    console.log(`!!! API_FETCH_START url=${url} cache=${cache || 'default'}`)
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, signal: controller.signal, cache: cache || 'no-store' } as any)
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      throw new ApiError(`Request failed with ${res.status}`, res.status, json)
    }
    if (!json) {
      throw new ApiError('Failed to parse response', res.status)
    }
    return { res, json }
  } catch (e: any) {
    if (e?.name === 'AbortError' || e?.message?.toLowerCase().includes('abort') || e?.message?.includes('timeout')) {
      throw new Error(`Request timeout/aborted after ${timeoutMs}ms: ${e.message}`)
    }
    if (e instanceof ApiError) throw e
    throw new Error(`Network error: ${e.message || String(e)}`)
  } finally {
    clearTimeout(timeout)
  }
}

export async function fetchHealth(options: FetchOptions = {}): Promise<HealthResponse> {
  const { json } = await fetchJson('/api/health', options)
  return json as HealthResponse
}

export async function fetchContent(slug: string, options: FetchOptions = {}): Promise<ContentResponse> {
  const safeSlug = encodeURIComponent(slug)
  const { json } = await fetchJson(`/api/content/${safeSlug}`, options)
  return json as ContentResponse
}

export interface CalendarSlot {
  date: string // YYYY-MM-DD
  start: string // ISO
  end: string // ISO
  available: boolean
}

export interface SlotsResponse {
  slots: CalendarSlot[]
  weeks: number
  source: 'stub' | 'live' | string
  workingHours?: any
  calendars?: any
  error?: string
}

export async function fetchCalendarSlots(weeks: number = 2, options: FetchOptions = {}): Promise<CalendarSlot[]> {
  const bust = `_t=${Date.now()}`
  const sep = `?weeks=${weeks}`.includes('?') ? '&' : '?'
  const url = `/api/calendar/slots?weeks=${weeks}&${bust}`
  const { json } = await fetchJson(url, { ...options, cache: 'no-store' } as any)
  const data = json as SlotsResponse
  return data.slots as CalendarSlot[]
}

export async function fetchSlotsFull(weeks: number = 2, options: FetchOptions = {}): Promise<SlotsResponse> {
  const bust = `_t=${Date.now()}`
  const url = `/api/calendar/slots?weeks=${weeks}&${bust}`
  const { json } = await fetchJson(url, { ...options, cache: 'no-store' } as any)
  return json as SlotsResponse
}

export interface BookingPayload {
  firstName: string
  lastName: string
  email: string
  phone?: string
  purpose?: string
  slot: CalendarSlot | { date?: string; start: string; end: string }
  turnstileToken?: string
  confirmIntent?: boolean
}

export interface BookingResponse {
  meetLink: string
  dateTime: string
  cancelUrl: string
  cancelToken?: string
  calendarEventId?: string
  source?: string
  warning?: string
  confirmIntent?: boolean
  duplicateWarning?: boolean
  gcalError?: string
  emailResult?: { success: boolean; source: string; error?: string; id?: string }
  diag?: { bookingCalendar: boolean; gcalKey: boolean; resendKey: boolean; env?: string }
}

export async function createBooking(payload: BookingPayload, options: FetchOptions = {}): Promise<BookingResponse> {
  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? 8000
  const timeout = setTimeout(() => controller.abort(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs)
  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort(options.signal!.reason))
  }
  try {
    const res = await fetch('/api/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        phone: payload.phone,
        purpose: payload.purpose,
        slot: payload.slot,
        turnstileToken: payload.turnstileToken,
        confirmIntent: payload.confirmIntent,
      }),
      signal: controller.signal,
    })
    const j = await res.json().catch(() => null)
    if (!res.ok) {
      throw new ApiError(`Request failed with ${res.status}`, res.status, j)
    }
    if (!j) throw new ApiError('Failed to parse booking response', res.status)
    return j as BookingResponse
  } catch (e: any) {
    if (e instanceof ApiError) throw e
    if (e?.name === 'AbortError' || e?.message?.toLowerCase().includes('abort') || e?.message?.includes('timeout')) {
      throw new Error(`Booking timeout after ${timeoutMs}ms: ${e.message}`)
    }
    throw new Error(`Network error: ${e.message || String(e)}`)
  } finally {
    clearTimeout(timeout)
  }
}
