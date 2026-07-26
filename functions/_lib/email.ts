import { getResendApiKey } from './env'

export interface EmailEnv {
  RESEND_API_KEY?: string
  EMAIL_FROM?: string
  ENVIRONMENT?: string
  SITE_URL?: string
  [key: string]: any
}

export interface SendEmailParams {
  to: string
  firstName: string
  lastName: string
  meetLink: string
  cancelUrl: string
  dateTime: string
  purpose?: string
  env: EmailEnv
}

export interface SendEmailResult {
  success: boolean
  id?: string
  source: 'live' | 'stub'
  error?: string
}

export function buildConfirmationEmail(params: {
  firstName: string
  lastName: string
  email: string
  meetLink: string
  cancelUrl: string
  dateTime: string
  purpose?: string
  env?: any
}): string {
  const { firstName, lastName, email, meetLink, cancelUrl, dateTime, purpose } = params

  // No calendar IDs leaked — only email/purpose/meetLink/cancelUrl/dateTime per requirement
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Meeting Confirmed — ${dateTime}</h2>
      <p>Hi ${firstName} ${lastName || ''},</p>
      <p>Your meeting is confirmed for <strong>${dateTime}</strong>.</p>
      ${purpose ? `<p><strong>Purpose:</strong> ${purpose}</p>` : ''}
      <p><strong>Email:</strong> ${email}</p>
      <p>Meet link: <a href="${meetLink}">${meetLink}</a></p>
      <p>Cancel link: <a href="${cancelUrl}">${cancelUrl}</a></p>
      <p>Google Calendar invite also sent with Meet join button + description containing Meet link.</p>
      <p>Thanks!</p>
    </div>
  `.trim()
}

export function getSubject(env?: EmailEnv, dateTime?: string): string {
  const isAlpha = env?.ENVIRONMENT === 'alpha'
  const prefix = isAlpha ? '[ALPHA] ' : ''
  return `${prefix}Meeting confirmed — ${dateTime || ''}`.trim()
}

export async function sendConfirmationEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { to, firstName, lastName, meetLink, cancelUrl, dateTime, purpose, env } = params

  const from = env?.EMAIL_FROM || env?.FROM || 'onboarding@resend.dev'
  const apiKey = getResendApiKey(env) || env?.RESEND_API_KEY

  // Stub when key missing — return mock success and log (test env with key should still call fetch via mocked global.fetch)
  if (!apiKey) {
    console.log(`[STUB Email] To: ${to}, Meet: ${meetLink}, Cancel: ${cancelUrl}, Date: ${dateTime}, Purpose: ${purpose} — RESEND_API_KEY missing, checked aliases`)
    return { success: true, id: 'mock-id', source: 'stub', error: 'RESEND_API_KEY missing' }
  }

  const isTestEnv = env?.ENVIRONMENT === 'test' && !getResendApiKey({ RESEND_API_KEY: 'force-live-for-test' }) ? false : env?.ENVIRONMENT === 'test'
  // In test env, if global.fetch is mocked, we still attempt live so tests can verify body
  // Only stub if explicitly in test AND no mock? Actually keep live path when key present

  try {
    const subject = getSubject(env, dateTime)
    const html = buildConfirmationEmail({ firstName, lastName, email: to, meetLink, cancelUrl, dateTime, purpose, env })

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      const msg = `Resend failed ${res.status} ${text}`
      console.error(`[Email live FAILED] ${msg} — To: ${to}, From: ${from}, Env: ${env?.ENVIRONMENT}`)
      // For Resend test mode onboarding@resend.dev only to verified email, this will be 403
      // Return error but mark success false for diagnostics, caller will include emailError
      return { success: false, id: undefined, source: 'live', error: msg }
    }

    const json = (await res.json()) as any
    console.log(`[Email live SUCCESS] To: ${to}, Id: ${json.id}, Env: ${env?.ENVIRONMENT}`)
    return { success: true, id: json.id, source: 'live' }
  } catch (e: any) {
    const errMsg = e?.message || String(e)
    console.error(`[Email exception] Error: ${errMsg}, To: ${to}, Meet: ${meetLink}, Env: ${env?.ENVIRONMENT}`)
    // In local/test, fallback to stub success for resilience; in alpha/prod, return live error so caller can surface
    if (env?.ENVIRONMENT === 'local' || env?.ENVIRONMENT === 'test') {
      return { success: true, id: 'mock-id-fallback', source: 'stub', error: errMsg }
    }
    return { success: false, source: 'live', error: errMsg }
  }
}
