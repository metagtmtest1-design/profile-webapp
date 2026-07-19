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
  r2: 'ok' | 'error'
  timestamp: string
  env: string
  checks: {
    d1Ms: number
    r2Ms: number
  }
  dbError?: string
  r2Error?: string
  sampleImageUrl?: string
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const timestamp = new Date().toISOString()
  const envName = getEnvironment(env as EnvVars)
  const siteUrl = (env as any)?.SITE_URL || ''

  // Run checks in parallel but with independent error handling
  const [d1Result, r2Result] = await Promise.all([
    checkD1(env?.DB),
    checkR2(env?.R2_BUCKET),
  ])

  const dbStatus = d1Result.ok ? 'ok' : 'error'
  const r2Status = r2Result.ok ? 'ok' : 'error'

  let status: HealthResponse['status'] = 'ok'
  if (!d1Result.ok && !r2Result.ok) {
    status = 'error'
  } else if (!d1Result.ok || !r2Result.ok) {
    status = 'error' // For slice 0, any failure = error (strict)
  }

  // Sample image URL from R2 for frontend verification (if R2 works, construct URL)
  // In real deploy, R2 images served via /r2 or custom domain, here we return placeholder path
  const sampleImageUrl = r2Result.ok
    ? `${siteUrl || ''}/r2-sample/test-image.jpg`.replace(/\/\//g, '/').replace(':/', '://')
    : undefined

  const response: HealthResponse = {
    status,
    db: dbStatus as any,
    r2: r2Status as any,
    timestamp,
    env: envName,
    checks: {
      d1Ms: d1Result.ms,
      r2Ms: r2Result.ms,
    },
    sampleImageUrl: sampleImageUrl || `https://via.placeholder.com/300x200?text=R2+${r2Status}`,
  }

  if (!d1Result.ok) {
    response.dbError = d1Result.error
  }
  if (!r2Result.ok) {
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
