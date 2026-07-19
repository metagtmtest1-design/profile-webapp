import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchHealth } from './api'

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
