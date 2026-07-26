import React, { useState, useEffect } from 'react'
import type { CalendarSlot } from '../../lib/api'
import { createBooking } from '../../lib/api'
import { generateIcsContent, downloadIcsFile } from '../../lib/ics'

export interface BookingFormProps {
  slot: CalendarSlot
  onSuccess: (data: { meetLink: string; dateTime: string; cancelUrl: string; source?: string; gcalError?: string; emailResult?: any }) => void
  onCancel?: () => void
}

export function BookingForm({ slot, onSuccess, onCancel }: BookingFormProps) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [purpose, setPurpose] = useState('')
  // Start empty — real token from Turnstile widget in prod/alpha, fake only for local/test (TDD)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [confirmIntent, setConfirmIntent] = useState(false)
  const [success, setSuccess] = useState<{ meetLink: string; dateTime: string; cancelUrl: string; source?: string; gcalError?: string; emailResult?: any } | null>(null)

  // Load Turnstile widget — real token for alpha/prod, fake stub for local/test (so TDD not blocked)
  // Store widgetId for reset
  const widgetIdRef = React.useRef<string | number | null>(null)

  const renderTurnstile = React.useCallback(() => {
    const isLocalHost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    if (isLocalHost) {
      console.log('!!! TURNSTILE_FORM_LOCALHOST fake token')
      setTurnstileToken('fake-token-for-test')
      return true
    }
    const siteKey = (window as any)?.TURNSTILE_SITE_KEY || '0x4AAAAAAD8-3h6x-RUDasMf'
    if (typeof window !== 'undefined' && (window as any).turnstile) {
      try {
        console.log(`!!! TURNSTILE_FORM_RENDER_START siteKey=${siteKey}`)
        const existing = document.querySelector('#turnstile-widget')
        if (existing) existing.innerHTML = ''
        // Reset previous if any
        if (widgetIdRef.current !== null) {
          try {
            ;(window as any).turnstile.remove(widgetIdRef.current)
          } catch {}
        }
        const id = (window as any).turnstile.render('#turnstile-widget', {
          sitekey: siteKey,
          callback: (token: string) => {
            console.log(`!!! TURNSTILE_FORM_CALLBACK tokenLen=${token.length}`)
            setTurnstileToken(token)
          },
          'error-callback': () => {
            console.log('!!! TURNSTILE_FORM_ERROR_CALLBACK')
            setTurnstileToken('')
          },
          'expired-callback': () => {
            console.log('!!! TURNSTILE_FORM_EXPIRED_CALLBACK')
            setTurnstileToken('')
          },
        })
        widgetIdRef.current = id
        console.log(`!!! TURNSTILE_FORM_RENDERED widgetId=${String(id)}`)
        return true
      } catch (e: any) {
        console.log(`!!! TURNSTILE_FORM_RENDER_FAILED ${e?.message}`)
        return false
      }
    }
    console.log('!!! TURNSTILE_FORM_NOT_READY window.turnstile missing')
    return false
  }, [])

  const resetTurnstile = React.useCallback(() => {
    console.log('!!! TURNSTILE_FORM_RESET_START')
    setTurnstileToken('')
    const isLocalHost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    if (isLocalHost) {
      console.log('!!! TURNSTILE_FORM_RESET_LOCALHOST fake token')
      setTurnstileToken('fake-token-for-test')
      return
    }
    try {
      if (widgetIdRef.current !== null && (window as any)?.turnstile) {
        console.log(`!!! TURNSTILE_FORM_RESET widgetId=${String(widgetIdRef.current)}`)
        ;(window as any).turnstile.reset(widgetIdRef.current)
      } else {
        console.log('!!! TURNSTILE_FORM_RESET_NO_ID re-render')
        renderTurnstile()
      }
    } catch (e: any) {
      console.log(`!!! TURNSTILE_FORM_RESET_FAILED ${e?.message} fallback re-render`)
      // Fallback re-render
      renderTurnstile()
    }
  }, [renderTurnstile])

  useEffect(() => {
    const isLocalHost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    if (isLocalHost) {
      setTurnstileToken('fake-token-for-test')
      return
    }
    if (!renderTurnstile()) {
      const interval = setInterval(() => {
        if (renderTurnstile()) clearInterval(interval)
      }, 500)
      setTimeout(() => clearInterval(interval), 10000)
      return () => clearInterval(interval)
    }
  }, [renderTurnstile])

  const validate = (): string | null => {
    if (!firstName.trim()) return 'First name is required'
    if (!lastName.trim()) return 'Last name is required'
    if (!email.trim()) return 'Email is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email format'
    if (!slot?.start || !slot?.end) return 'Slot is required'
    const isLocalHost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    if (!isLocalHost && !turnstileToken) return 'Please complete verification (Turnstile)'
    return null
  }

  const doBooking = async (intentOverride?: boolean) => {
    console.log(`!!! BOOKING_FORM_DO_BOOKING_START firstName=${firstName} email=${email} slot=${slot.start} confirmIntent=${intentOverride ?? confirmIntent} hasToken=${!!turnstileToken}`)
    const v = validate()
    if (v) {
      console.log(`!!! BOOKING_FORM_VALIDATION_FAILED ${v}`)
      setError(v)
      return null
    }
    setLoading(true)
    setError(null)
    try {
      console.log('!!! BOOKING_FORM_API_CALL_START')
      const result = await createBooking({
        firstName,
        lastName,
        email,
        phone: phone || undefined,
        purpose: purpose || undefined,
        slot,
        turnstileToken,
        confirmIntent: intentOverride ?? confirmIntent,
      })
      console.log(`!!! BOOKING_FORM_API_RESULT warning=${!!(result as any).warning} meetLink=${result.meetLink} source=${result.source} gcalError=${result.gcalError || 'none'} emailSuccess=${result.emailResult?.success}`)
      // Handle duplicate warning same email this week — token is consumed by first verify, need new token for confirm
      if ((result as any).warning) {
        console.log(`!!! BOOKING_FORM_DUPLICATE_WARNING ${(result as any).warning}`)
        setWarning((result as any).warning)
        setConfirmIntent(true)
        // Turnstile tokens are single-use (Cloudflare invalidates after siteverify) — reset for confirm flow
        resetTurnstile()
        return null
      }
      console.log(`!!! BOOKING_FORM_SUCCESS meetLink=${result.meetLink} source=${result.source}`)
      setSuccess({
        meetLink: result.meetLink,
        dateTime: result.dateTime,
        cancelUrl: result.cancelUrl,
        source: result.source,
        gcalError: result.gcalError,
        emailResult: result.emailResult,
      })
      onSuccess({
        meetLink: result.meetLink,
        dateTime: result.dateTime,
        cancelUrl: result.cancelUrl,
        source: result.source,
        gcalError: result.gcalError,
        emailResult: result.emailResult,
      })
      return result
    } catch (err: any) {
      const msg = err.body?.error || err.message || 'Booking failed'
      console.log(`!!! BOOKING_FORM_ERROR ${msg} body=${JSON.stringify(err.body || {}).slice(0, 300)}`)
      const bodyStr = JSON.stringify(err.body || {})
      setError(msg)
      // If Turnstile failed (token reused/expired), reset for retry
      if (bodyStr.toLowerCase().includes('turnstile') || msg.toLowerCase().includes('turnstile')) {
        console.log('!!! BOOKING_FORM_TURNSTILE_FAIL_RESET')
        resetTurnstile()
      }
      return null
    } finally {
      setLoading(false)
      console.log('!!! BOOKING_FORM_DO_BOOKING_END')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    console.log('!!! BOOKING_FORM_HANDLE_SUBMIT')
    e.preventDefault()
    setWarning(null)
    await doBooking()
  }

  const handleConfirmAndBookAgain = async () => {
    console.log('!!! BOOKING_FORM_CONFIRM_AND_BOOK_AGAIN_CLICK')
    // User confirms intent to book again this week — immediately rebook with confirmIntent=true
    setConfirmIntent(true)
    setWarning(null)
    setError(null)
    await doBooking(true)
  }

  if (success) {
    const isFakeMeet = success.meetLink.includes('fake-')
    const handleDownloadIcs = () => {
      const ics = generateIcsContent({
        title: `Meeting — ${firstName} ${lastName}`,
        description: `${purpose || 'Intro call'}\nMeet: ${success.meetLink}\nCancel: ${success.cancelUrl}`,
        location: success.meetLink,
        start: slot.start,
        end: slot.end,
        meetLink: success.meetLink,
        attendee: email,
      })
      downloadIcsFile(ics, `meeting-${slot.date}.ics`)
    }

    return (
      <div className="card rounded-2xl p-6 bg-green-50 border-green-300">
        <h3 className="font-bold text-lg mb-2">Meeting Confirmed ✅</h3>
        <p className="text-sm mb-2">Date: {success.dateTime}</p>
        <p className="text-sm mb-3">
          Meet: <a href={success.meetLink} className="underline" target="_blank" rel="noopener noreferrer">{success.meetLink}</a>
        </p>
        {isFakeMeet && (
          <div className="p-3 border border-amber-300 bg-amber-50 rounded-lg text-xs text-amber-800 mb-3">
            <div className="font-semibold">⚠️ Fake Meet link (stub)</div>
            <div>This booking used stub data — Google Calendar secrets missing or permission error. In alpha/prod, check /api/debug/diag — ensure GCAL_SERVICE_ACCOUNT_KEY, BOOKING_CALENDAR_ID, calendar shared as Make changes and see all event details.</div>
            {success.gcalError && <div className="mt-1 font-mono text-[11px] break-all">Error: {success.gcalError}</div>}
          </div>
        )}
        {success.emailResult && !success.emailResult.success && (
          <div className="p-3 border border-orange-300 bg-orange-50 rounded-lg text-xs text-orange-800 mb-3">
            <div className="font-semibold">📧 Email not sent — but booking saved</div>
            <div>{success.emailResult.error || 'Resend failed'}</div>
            <div className="mt-1 text-[11px]">If using onboarding@resend.dev test mode, send only to your own verified email. Verify custom domain in Resend to email any visitor.</div>
            <div className="mt-1">Check /api/debug/diag → email section</div>
          </div>
        )}
        {success.emailResult && success.emailResult.success && success.emailResult.source === 'live' && (
          <div className="p-2 border border-green-200 bg-white rounded-lg text-[11px] text-green-700 mb-3">
            📧 Confirmation email sent via Resend ({success.emailResult.id})
          </div>
        )}
        <div className="flex flex-wrap gap-3 mt-4">
          <button onClick={handleDownloadIcs} className="px-6 py-3 bg-slate-900 text-white rounded-full text-sm font-semibold hover:bg-black leading-none">
            Download invite (.ics)
          </button>
          <a href={success.cancelUrl} className="px-6 py-3 rounded-full border border-red-200 bg-white text-red-700 text-sm font-semibold hover:bg-red-50 leading-none inline-flex items-center justify-center">
            Cancel meeting
          </a>
          <button onClick={() => navigator.clipboard.writeText(success.meetLink)} className="px-6 py-3 bg-black text-white rounded-full text-sm font-medium leading-none">
            Copy Meet link
          </button>
        </div>
        {onCancel && (
          <button onClick={onCancel} className="mt-6 px-6 py-3 border rounded-full text-sm font-medium hover:bg-gray-50 leading-none">
            Close
          </button>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="card rounded-2xl p-6 bg-white shadow-sm max-w-md w-full">
      <div className="flex justify-between items-start gap-3 mb-4">
        <div>
          <h3 className="font-bold text-lg tracking-tight">Book {slot.date} — {new Date(slot.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} - {new Date(slot.end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</h3>
          <p className="text-xs text-gray-500 mt-1">Fill details, Turnstile protected, Meet link auto</p>
        </div>
        {onCancel && (
          <button type="button" onClick={onCancel} aria-label="Close" className="w-8 h-8 rounded-full border bg-white text-gray-600 hover:bg-gray-50 flex items-center justify-center text-sm">
            ✕
          </button>
        )}
      </div>

      {warning && (
        <div className="p-3 border border-amber-300 bg-amber-50 rounded-lg text-sm mb-4">
          <div className="font-semibold">Confirm intent?</div>
          <div>{warning}</div>
          <div className="text-xs mt-1">You already booked this week. Turnstile token is single-use, so please verify again then confirm.</div>
          {!turnstileToken && (
            <div className="text-[11px] text-amber-700 mt-1">Verification expired — completing Turnstile challenge…</div>
          )}
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={handleConfirmAndBookAgain}
              disabled={loading || !turnstileToken}
              className="px-4 py-2 bg-black text-white rounded-full text-xs font-semibold hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? 'Booking…' : !turnstileToken ? 'Waiting for verification…' : 'Confirm and book again'}
            </button>
            <button type="button" onClick={() => { setWarning(null); setConfirmIntent(false); resetTurnstile(); }} className="px-3 py-2 border rounded-full text-xs bg-white hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 border border-red-300 bg-red-50 rounded-lg text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="firstName" className="block text-xs font-semibold mb-1">First name *</label>
          <input id="firstName" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" required />
        </div>
        <div>
          <label htmlFor="lastName" className="block text-xs font-semibold mb-1">Last name *</label>
          <input id="lastName" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" required />
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="email" className="block text-xs font-semibold mb-1">Email *</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" required />
      </div>

      <div className="mt-4">
        <label htmlFor="phone" className="block text-xs font-semibold mb-1">Phone (optional)</label>
        <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="+1 (555) ..." />
      </div>

      <div className="mt-4">
        <label htmlFor="purpose" className="block text-xs font-semibold mb-1">Purpose</label>
        <textarea id="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" rows={3} placeholder="Brand strategy intro, logo review, etc." />
      </div>

      {/* Turnstile widget — invisible challenge on booking form */}
      <div className="mt-4">
        <div id="turnstile-widget" data-sitekey="0x4AAAAAAD8-3h6x-RUDasMf" className="text-xs text-gray-400">
          Protected by Turnstile (verification)
        </div>
        {/* Hidden input for token in tests */}
        <input type="hidden" value={turnstileToken} readOnly data-testid="turnstile-token" />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-6 w-full px-6 py-3 bg-black text-white rounded-full font-bold text-sm hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Booking… (1-2s) Meet link auto' : 'Book meeting — Meet link auto'}
      </button>

      <div className="mt-3 text-[11px] text-gray-400 text-center">
        Anti-bot: Turnstile + rate limit 3/email/week • Google Meet auto-generated via conferenceData • Resend email with Meet + cancel link • FreeBusy re-check race guard
      </div>
    </form>
  )
}
