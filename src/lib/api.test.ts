import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchHealth, fetchContent } from './api'

describe('api client - fetchHealth', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should fetch /api/health and parse ok response', async () => {
    const mockResponse = {
      status: 'ok',
      db: 'ok',
      r2: 'ok',
      timestamp: new Date().toISOString(),
      env: 'test',
      checks: { d1Ms: 2, r2Ms: 3 },
    }

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as any)

    const result = await fetchHealth()
    expect(result).toEqual(mockResponse)
    expect(fetch).toHaveBeenCalledWith('/api/health', expect.objectContaining({
      method: 'GET',
    }))
  })

  it('should throw ApiError when health returns 500', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ status: 'error', db: 'error', r2: 'ok' }),
    } as any)

    await expect(fetchHealth()).rejects.toThrow(/500/)
  })

  it('should handle network failure gracefully', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

    await expect(fetchHealth()).rejects.toThrow(/Network/)
  })

  it('should timeout with AbortController when configured', async () => {
    vi.mocked(fetch).mockImplementation(((_url: any, opts: any) =>
      new Promise((_resolve, reject) => {
        // Respect abort signal
        const signal = opts?.signal as AbortSignal | undefined
        if (signal) {
          if (signal.aborted) {
            reject(new DOMException('Aborted', 'AbortError'))
            return
          }
          signal.addEventListener('abort', () => {
            reject(new DOMException(`Aborted after timeout`, 'AbortError'))
          })
        }
        // Never resolve otherwise — let abort trigger
      })) as any)

    await expect(fetchHealth({ timeoutMs: 10 })).rejects.toThrow(/timeout|abort/i)
  })

  it('should return parsed JSON on success even without checks', async () => {
    const minimal = {
      status: 'ok',
      db: 'ok',
      r2: 'ok',
      timestamp: new Date().toISOString(),
      env: 'test',
    }
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => minimal,
    } as any)

    const result = await fetchHealth()
    expect(result.db).toBe('ok')
    expect(result.r2).toBe('ok')
  })
})

describe('api client - fetchContent', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should fetch /api/content/home and parse page+sections+items', async () => {
    const mock = {
      page: { id: 'p1', slug: 'home', title: 'Portfolio', meta_description: 'Desc', sort_order: 0, is_published: 1 },
      sections: [
        { id: 's1', page_id: 'p1', type: 'hero', heading: 'Hi', sort_order: 0, is_visible: 1, config: {}, items: [{ id: 'i1', title: 'T', sort_order: 0, is_visible: 1 }] },
      ],
    }
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200, json: async () => mock } as any)
    const result = await fetchContent('home')
    expect(result.page.slug).toBe('home')
    expect(result.sections.length).toBe(1)
    expect(fetch).toHaveBeenCalledWith('/api/content/home', expect.anything())
  })

  it('should throw ApiError 404 for unknown slug', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: 'Page not found' }) } as any)
    await expect(fetchContent('unknown')).rejects.toThrow(/404/)
  })

  it('should handle network error for content', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))
    await expect(fetchContent('home')).rejects.toThrow(/Network/)
  })
})

describe('api client - fetchCalendarSlots', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.restoreAllMocks())

  it('should fetch /api/calendar/slots?weeks=2 and parse slots', async () => {
    const { fetchCalendarSlots } = await import('./api')
    const mock = {
      slots: [
        { date: '2026-07-20', start: '2026-07-20T09:00:00Z', end: '2026-07-20T09:30:00Z', available: true },
      ],
      weeks: 2,
      source: 'stub',
    }
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200, json: async () => mock } as any)
    const result = await fetchCalendarSlots(2)
    expect(result.length).toBe(1)
    expect(fetch).toHaveBeenCalledWith('/api/calendar/slots?weeks=2', expect.anything())
  })

  it('should handle weeks param', async () => {
    const { fetchCalendarSlots } = await import('./api')
    const mock = { slots: [], weeks: 1, source: 'stub' }
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200, json: async () => mock } as any)
    await fetchCalendarSlots(1)
    expect(fetch).toHaveBeenCalledWith('/api/calendar/slots?weeks=1', expect.anything())
  })

  it('should throw on 500 for calendar slots', async () => {
    const { fetchCalendarSlots } = await import('./api')
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'fail' }) } as any)
    await expect(fetchCalendarSlots(2)).rejects.toThrow(/500/)
  })
})
