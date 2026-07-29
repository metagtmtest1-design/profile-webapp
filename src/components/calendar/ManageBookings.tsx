import React, { useState, useEffect, useCallback, useRef } from 'react'

interface BookingItem {
  id: string
  purpose: string | null
  calendarEventId: string
  cancelToken: string
  cancelUrl: string
  status: string
  createdAt: string
  dateTime: string
  meetLink?: string
}

export function ManageBookings() {
  const [email, setEmail] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bookings, setBookings] = useState<BookingItem[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  // Turnstile widget for lookup (reuse same site key)
  const widgetIdRef = useRef<string | number | null>(null)

  const renderTurnstile = useCallback(() => {
    const isLocalHost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    if (isLocalHost) {
      console.log('!!! MANAGE_TURNSTILE_LOCALHOST fake token')
      setTurnstileToken('fake-token-for-test')
      return true
    }
    const siteKey = (window as any)?.TURNSTILE_SITE_KEY || '0x4AAAAAAD8-3h6x-RUDasMf'
    if (typeof window !== 'undefined' && (window as any).turnstile) {
      try {
        console.log(`!!! MANAGE_TURNSTILE_RENDER siteKey=${siteKey}`)
        const el = document.querySelector('#manage-turnstile-widget')
        if (el) el.innerHTML = ''
        if (widgetIdRef.current !== null) {
          try {
            ;(window as any).turnstile.remove(widgetIdRef.current)
          } catch {}
        }
        const id = (window as any).turnstile.render('#manage-turnstile-widget', {
          sitekey: siteKey,
          callback: (token: string) => {
            console.log(`!!! MANAGE_TURNSTILE_CALLBACK len=${token.length}`)
            setTurnstileToken(token)
          },
          'error-callback': () => {
            console.log('!!! MANAGE_TURNSTILE_ERROR')
            setTurnstileToken('')
          },
          'expired-callback': () => {
            console.log('!!! MANAGE_TURNSTILE_EXPIRED')
            setTurnstileToken('')
          },
        })
        widgetIdRef.current = id
        return true
      } catch (e: any) {
        console.log(`!!! MANAGE_TURNSTILE_RENDER_FAIL ${e?.message}`)
        return false
      }
    }
    return false
  }, [])

  const resetTurnstile = useCallback(() => {
    console.log('!!! MANAGE_TURNSTILE_RESET')
    setTurnstileToken('')
    const isLocalHost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    if (isLocalHost) {
      setTurnstileToken('fake-token-for-test')
      return
    }
    try {
      if (widgetIdRef.current !== null && (window as any)?.turnstile) {
        ;(window as any).turnstile.reset(widgetIdRef.current)
      } else {
        renderTurnstile()
      }
    } catch {
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

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Invalid email format')
      return
    }
    if (!turnstileToken) {
      setError('Please complete verification (Turnstile)')
      return
    }
    console.log(`!!! MANAGE_LOOKUP_START email=${trimmed} hasToken=${!!turnstileToken}`)
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/bookings/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, turnstileToken }),
        cache: 'no-store' as any,
      })
      const json = (await res.json()) as any
      console.log(`!!! MANAGE_LOOKUP_RESULT status=${res.status} count=${json.count} bookings=${json.bookings?.length}`)
      if (!res.ok) {
        throw new Error(json.error || 'Lookup failed')
      }
      setBookings(json.bookings || [])
      setHasSearched(true)
      resetTurnstile()
    } catch (err: any) {
      console.log(`!!! MANAGE_LOOKUP_ERROR ${err.message}`)
      setError(err.message)
      resetTurnstile()
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async (booking: BookingItem) => {
    if (!confirm(`Cancel meeting ${booking.dateTime} — Purpose: ${booking.purpose || 'Intro'}? Slot will become free.`)) return
    console.log(`!!! MANAGE_CANCEL_START id=${booking.id} token=${booking.cancelToken.slice(0, 8)}...`)
    setCancellingId(booking.id)
    try {
      // Use existing cancel endpoint via token which deletes Google event + marks cancelled
      const res = await fetch(`/api/cancel/${booking.cancelToken}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store' as any,
      })
      const json = (await res.json().catch(() => ({}))) as any
      console.log(`!!! MANAGE_CANCEL_RESULT status=${res.status} success=${json.success} calendarDeleted=${json.calendarDeleted}`)
      if (!res.ok) {
        throw new Error(json.error || 'Cancel failed')
      }
      // Remove from list optimistically + refetch calendar via window dispatch or reload? We'll just filter
      setBookings((prev) => prev.filter((b) => b.id !== booking.id))
      // Trigger calendar refetch if on same page — dispatch custom event that Home listens for
      window.dispatchEvent(new CustomEvent('bookings-cancelled', { detail: { bookingId: booking.id } }))
    } catch (err: any) {
      console.log(`!!! MANAGE_CANCEL_ERROR ${err.message}`)
      setError(err.message)
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <section className="py-20 border-t bg-white">
      <div className="mx-auto max-w-3xl px-6">
        <h2 className="font-black text-3xl tracking-tight" style={{ fontFamily: 'Playfair Display, serif' }}>
          Manage bookings
        </h2>
        <p className="text-sm text-slate-600 mt-2">
          No custom domain for Resend? No problem — lookup your bookings by email and cancel directly from website. Purpose shown in list and will be in calendar invite.
        </p>

        <form onSubmit={handleLookup} className="card rounded-2xl p-6 mt-6 space-y-4">
          <div>
            <label className="label text-sm font-medium">Email address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="input w-full px-4 py-2.5 border rounded-xl text-sm mt-1" />
          </div>

          <div id="manage-turnstile-widget" data-testid="manage-turnstile-widget" className="min-h-[65px]" />

          <button type="submit" disabled={loading || !turnstileToken} className="btn-primary rounded-full w-full justify-center px-8 py-3 text-sm font-semibold leading-none disabled:opacity-50">
            {loading ? 'Looking up…' : !turnstileToken ? 'Waiting verification…' : 'Lookup bookings →'}
          </button>

          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        </form>

        {hasSearched && (
          <div className="mt-8">
            <h3 className="font-bold text-lg mb-4">Bookings for {email} — {bookings.length} found</h3>
            {bookings.length === 0 ? (
              <p className="text-sm text-slate-600">No upcoming bookings. Check email spelling or book a new meeting via calendar above.</p>
            ) : (
              <ul className="space-y-4">
                {bookings.map((b) => (
                  <li key={b.id} className="card rounded-2xl p-5 border flex flex-col gap-3">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <div className="text-sm font-bold">{b.dateTime}</div>
                        {b.purpose && <div className="text-xs mt-1 px-2 py-1 bg-slate-50 border rounded-full inline-block">Purpose: {b.purpose}</div>}
                        <div className="text-[11px] text-slate-500 mt-1">Booking ID: {b.id} — Purpose will be in calendar invite</div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[11px] font-semibold ${b.status === 'confirmed' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-50 text-slate-600 border'}`}>
                        {b.status}
                      </span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => handleCancel(b)} disabled={cancellingId === b.id} className="px-5 py-2.5 bg-white border border-red-200 text-red-700 rounded-full text-xs font-semibold hover:bg-red-50 disabled:opacity-50 leading-none">
                        {cancellingId === b.id ? 'Cancelling…' : 'Cancel meeting'}
                      </button>
                      <a href={b.cancelUrl} className="px-5 py-2.5 border rounded-full text-xs font-medium hover:bg-slate-50 leading-none" target="_blank" rel="noopener noreferrer">
                        Open cancel link
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  )
}


