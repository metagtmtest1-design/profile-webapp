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
}

async function fetchJson(url: string, options: FetchOptions & { method?: string } = {}) {
  const { timeoutMs = 5000, signal, method = 'GET' } = options
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs)
  if (signal) {
    signal.addEventListener('abort', () => controller.abort(signal.reason))
  }
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, signal: controller.signal })
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
  const { json } = await fetchJson(`/api/calendar/slots?weeks=${weeks}`, options)
  const data = json as SlotsResponse
  return data.slots as CalendarSlot[]
}

export async function fetchSlotsFull(weeks: number = 2, options: FetchOptions = {}): Promise<SlotsResponse> {
  const { json } = await fetchJson(`/api/calendar/slots?weeks=${weeks}`, options)
  return json as SlotsResponse
}
