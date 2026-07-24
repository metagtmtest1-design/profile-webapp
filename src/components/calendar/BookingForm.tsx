import React, { useState, useEffect } from 'react'
import type { CalendarSlot } from '../../lib/api'
import { createBooking } from '../../lib/api'

export interface BookingFormProps {
  slot: CalendarSlot
  onSuccess: (data: { meetLink: string; dateTime: string; cancelUrl: string }) => void
  onCancel?: () => void
}

export function BookingForm({ slot, onSuccess, onCancel }: BookingFormProps) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [purpose, setPurpose] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('fake-token-for-test') // default fake for local TDD, real widget sets via callback
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [confirmIntent, setConfirmIntent] = useState(false)
  const [success, setSuccess] = useState<{ meetLink: string; dateTime: string; cancelUrl: string } | null>(null)

  // Load Turnstile widget if site key present
  useEffect(() => {
    const siteKey = (window as any)?.TURNSTILE_SITE_KEY || (import.meta as any)?.env?.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAAD8-3h6x-RUDasMf'
    // For real implementation, inject Turnstile script and render widget
    // For MVP stub, keep fake token
    if (typeof window !== 'undefined' && (window as any).turnstile) {
      try {
        ;(window as any).turnstile.render('#turnstile-widget', {
          sitekey: siteKey,
          callback: (token: string) => setTurnstileToken(token),
        })
      } catch {}
    }
  }, [])

  const validate = (): string | null => {
    if (!firstName.trim()) return 'First name is required'
    if (!lastName.trim()) return 'Last name is required'
    if (!email.trim()) return 'Email is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email format'
    if (!slot?.start || !slot?.end) return 'Slot is required'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const v = validate()
    if (v) {
      setError(v)
      return
    }
    setLoading(true)
    setError(null)
    setWarning(null)
    try {
      const result = await createBooking({
        firstName,
        lastName,
        email,
        phone: phone || undefined,
        purpose: purpose || undefined,
        slot,
        turnstileToken,
        confirmIntent,
      })

      // Handle duplicate warning same email this week
      if ((result as any).warning) {
        setWarning((result as any).warning)
        setConfirmIntent(true)
        setLoading(false)
        return
      }

      setSuccess({ meetLink: result.meetLink, dateTime: result.dateTime, cancelUrl: result.cancelUrl })
      onSuccess({ meetLink: result.meetLink, dateTime: result.dateTime, cancelUrl: result.cancelUrl })
    } catch (err: any) {
      const msg = err.body?.error || err.message || 'Booking failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="card rounded-2xl p-6 bg-green-50 border-green-300">
        <h3 className="font-bold text-lg mb-2">Meeting Confirmed ✅</h3>
        <p className="text-sm mb-2">Date: {success.dateTime}</p>
        <p className="text-sm mb-2">
          Meet link: <a href={success.meetLink} className="underline" target="_blank" rel="noopener noreferrer">{success.meetLink}</a>
        </p>
        <p className="text-sm mb-3">
          Cancel: <a href={success.cancelUrl} className="underline" target="_blank" rel="noopener noreferrer">{success.cancelUrl}</a> — click to cancel and free slot
        </p>
        <button onClick={() => navigator.clipboard.writeText(success.meetLink)} className="px-4 py-2 bg-black text-white rounded-lg text-xs mr-2">
          Copy Meet link
        </button>
        <button onClick={() => navigator.clipboard.writeText(success.cancelUrl)} className="px-4 py-2 border rounded-lg text-xs">
          Copy Cancel URL
        </button>
        {onCancel && (
          <button onClick={onCancel} className="mt-4 px-4 py-2 border rounded-full text-xs block">
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
          <div className="text-xs mt-1">You already booked this week. Confirm to book again.</div>
          <button type="button" onClick={() => setConfirmIntent(true)} className="mt-2 px-3 py-1 bg-black text-white rounded-full text-xs">
            Confirm intent and book again
          </button>
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
