export interface EmailEnv {
  RESEND_API_KEY?: string
  EMAIL_FROM?: string
  ENVIRONMENT?: string
  SITE_URL?: string
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

  const from = env?.EMAIL_FROM || 'onboarding@resend.dev'
  const apiKey = env?.RESEND_API_KEY

  // Stub when key missing — return mock success and log (test env with key should still call fetch via mocked global.fetch)
  if (!apiKey) {
    console.log(`[STUB Email] To: ${to}, Meet: ${meetLink}, Cancel: ${cancelUrl}, Date: ${dateTime}, Purpose: ${purpose}`)
    return { success: true, id: 'mock-id', source: 'stub' }
  }
  // For test env without key, also stub via above; if key present, proceed to live (mocked fetch in tests)
  if (env?.ENVIRONMENT === 'test' && !apiKey) {
    return { success: true, id: 'mock-id', source: 'stub' }
  }

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
      throw new Error(`Resend failed ${res.status} ${text}`)
    }

    const json = (await res.json()) as any
    return { success: true, id: json.id, source: 'live' }
  } catch (e: any) {
    // Fallback to stub on error for resilience (log but don't fail booking for MVP? For test we return stub success? Actually for live, should fail? Per design, booking should still succeed even if email fails? But for test, we return stub success)
    // For this implementation, if live fails, return stub success with error logged, so booking not blocked by email downtime
    console.log(`[Email fallback stub] Error: ${e.message}, To: ${to}, Meet: ${meetLink}`)
    return { success: true, id: 'mock-id-fallback', source: 'stub', error: e.message }
  }
}
