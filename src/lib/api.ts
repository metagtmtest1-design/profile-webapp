export interface HealthResponse {
  status: 'ok' | 'error' | 'degraded'
  db: 'ok' | 'error'
  r2: 'ok' | 'error' | 'skipped'
  timestamp: string
  env: string
  checks?: {
    d1Ms: number
    r2Ms: number
  }
  dbError?: string
  r2Error?: string
  sampleImageUrl?: string
  r2Note?: string
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

export async function fetchHealth(options: FetchOptions = {}): Promise<HealthResponse> {
  const { timeoutMs = 5000, signal } = options

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs)

  // If caller provided signal, abort our controller when theirs aborts
  if (signal) {
    signal.addEventListener('abort', () => controller.abort(signal.reason))
  }

  try {
    const res = await fetch('/api/health', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    })

    const json = await res.json().catch(() => null)

    if (!res.ok) {
      throw new ApiError(`Health check failed with ${res.status}`, res.status, json)
    }

    if (!json) {
      throw new ApiError('Failed to parse health response', res.status)
    }

    return json as HealthResponse
  } catch (e: any) {
    if (e?.name === 'AbortError' || e?.message?.toLowerCase().includes('abort') || e?.message?.includes('timeout')) {
      throw new Error(`Request timeout/aborted after ${timeoutMs}ms: ${e.message}`)
    }
    if (e instanceof ApiError) {
      throw e
    }
    throw new Error(`Network error: ${e.message || String(e)}`)
  } finally {
    clearTimeout(timeout)
  }
}
