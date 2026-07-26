export interface TurnstileResult {
  ok: boolean
  source: 'live' | 'stub'
  error?: string
}

export interface TurnstileEnv {
  ENVIRONMENT?: string
  STUB?: string
  TURNSTILE_SECRET_KEY?: string
  REMOTE_IP?: string
}

export async function verifyTurnstile(token: string, secret: string, env?: TurnstileEnv | any): Promise<TurnstileResult> {
  const environment = env?.ENVIRONMENT || ''
  const isStub = !token || !secret || environment === 'local' || environment === 'test' || env?.STUB === 'true' || secret === '' || token === ''

  // For local/test/STUB=true or missing secret/token, bypass for TDD (mock true)
  if (isStub) {
    // If token explicitly empty and we are in production, should fail — but per test, test env bypasses
    if ((environment === 'production' || environment === 'alpha') && (!token || !secret)) {
      // In real production, empty token should fail even if stub? But per our STUB design, test env bypasses
      // For this implementation, if ENVIRONMENT is production/alpha and token empty, and STUB not set, fail
      if (!token) {
        return { ok: false, source: 'live', error: 'Turnstile token missing' }
      }
    }
    // For test/local, always true when stub condition
    if (environment === 'local' || environment === 'test' || env?.STUB === 'true' || !secret || !token) {
      // For the specific test that expects 400 when token missing/invalid in production, we handle below
      // For test env, return stub true
      if (environment === 'test' || environment === 'local' || env?.STUB === 'true') {
        return { ok: true, source: 'stub' }
      }
    }
  }

  // If token or secret missing, fail (unless stub bypass above)
  if (!token || !secret) {
    return { ok: false, source: 'live', error: 'Turnstile token or secret missing' }
  }

  try {
    const formData = new URLSearchParams()
    formData.append('secret', secret)
    formData.append('response', token)
    if (env?.REMOTE_IP) {
      formData.append('remoteip', env.REMOTE_IP)
    }

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      return { ok: false, source: 'live', error: `Turnstile siteverify failed ${res.status}` }
    }

    const json = (await res.json()) as any
    if (json.success) {
      return { ok: true, source: 'live' }
    } else {
      return { ok: false, source: 'live', error: json['error-codes']?.join(',') || 'Turnstile verification failed' }
    }
  } catch (e: any) {
    return { ok: false, source: 'live', error: e?.message || String(e) }
  }
}
