import { checkD1, type D1Like } from '../_lib/db'
import { checkR2, type R2Like } from '../_lib/r2'
import { getEnvironment, type EnvVars } from '../_lib/env'

export interface Env {
  DB?: D1Like
  R2_BUCKET?: R2Like
  ENVIRONMENT?: string
  SITE_URL?: string
}

interface HealthResponse {
  status: 'ok' | 'error' | 'degraded'
  db: 'ok' | 'error'
  r2: 'ok' | 'error' | 'skipped'
  timestamp: string
  env: string
  checks: {
    d1Ms: number
    r2Ms: number
  }
  dbError?: string
  r2Error?: string
  sampleImageUrl?: string
  r2Note?: string
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const timestamp = new Date().toISOString()
  const envName = getEnvironment(env as EnvVars)
  const siteUrl = (env as any)?.SITE_URL || ''
  const hasR2Binding = !!env?.R2_BUCKET

  // Run checks in parallel but with independent error handling
  const [d1Result, r2Result] = await Promise.all([
    checkD1(env?.DB),
    hasR2Binding ? checkR2(env?.R2_BUCKET) : Promise.resolve({ ok: true, ms: 0, skipped: true } as any),
  ])

  const dbStatus = d1Result.ok ? 'ok' : 'error'
  // If no R2 binding, treat as skipped (ok for Slice 0 without R2 enabled)
  const r2Status = !hasR2Binding ? 'skipped' : r2Result.ok ? 'ok' : 'error'

  let status: HealthResponse['status'] = 'ok'
  // D1 must be ok. R2 is optional for Slice 0 when no binding (skipped), but if binding exists and fails, it's error
  if (!d1Result.ok) {
    status = 'error'
  } else if (hasR2Binding && !r2Result.ok) {
    status = 'error'
  }

  const sampleImageUrl = r2Result.ok
    ? `${siteUrl || ''}/r2-sample/test-image.jpg`.replace(/\/\//g, '/').replace(':/', '://')
    : `https://via.placeholder.com/300x200?text=R2+${r2Status}`

  const response: HealthResponse = {
    status,
    db: dbStatus as any,
    r2: r2Status as any,
    timestamp,
    env: envName,
    checks: {
      d1Ms: d1Result.ms,
      r2Ms: hasR2Binding ? r2Result.ms : 0,
    },
    sampleImageUrl,
    ...(hasR2Binding ? {} : { r2Note: 'R2 not configured — skipped for Slice 0 (enable R2 in dashboard to use)' }),
  }

  if (!d1Result.ok) {
    response.dbError = d1Result.error
  }
  if (hasR2Binding && !r2Result.ok) {
    response.r2Error = r2Result.error
  }

  const httpStatus = status === 'ok' ? 200 : 500

  return new Response(JSON.stringify(response), {
    status: httpStatus,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, max-age=0',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
