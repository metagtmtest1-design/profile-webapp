import React, { useState, useMemo } from 'react'
import { useContent } from '../hooks/useContent'
import { HeroSection } from '../components/sections/HeroSection'
import { CardsGrid } from '../components/sections/CardsGrid'
import { TextBlock } from '../components/sections/TextBlock'
import { Testimonials } from '../components/sections/Testimonials'
import { CTABanner } from '../components/sections/CTABanner'
import { ImageGallery } from '../components/sections/ImageGallery'
import { CalendarView } from '../components/calendar/CalendarView'
import { SlotPicker } from '../components/calendar/SlotPicker'
import { BookingForm } from '../components/calendar/BookingForm'
import { useCalendar } from '../hooks/useCalendar'
import { TIMEZONE_LABEL } from '../lib/constants'
import { generateIcsContent, downloadIcsFile } from '../lib/ics'
import type { Section } from '../lib/api'

function renderSection(section: Section) {
  const items = section.items || []
  switch (section.type) {
    case 'hero': return <HeroSection key={section.id} section={section} items={items} />
    case 'cards-grid': return <div key={section.id} id="services"><CardsGrid section={section} items={items} /></div>
    case 'text-block': return <div key={section.id} id="about"><TextBlock section={section} items={items} /></div>
    case 'testimonials': return <div key={section.id} id="testimonials"><Testimonials section={section} items={items} /></div>
    case 'cta-banner': return <CTABanner key={section.id} section={section} items={items} />
    case 'image-gallery': return <ImageGallery key={section.id} section={section} items={items} />
    default: return null
  }
}

export function Home() {
  const { data, loading, error } = useContent('home')
  const { slots, grouped, loading: calLoading, error: calError, slotMinutes, excludeToday, refetch: refetchCalendar } = useCalendar(2)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<any>(null)
  const [bookingResult, setBookingResult] = useState<{ meetLink: string; dateTime: string; cancelUrl: string; source?: string; gcalError?: string; emailResult?: any } | null>(null)

  const selectedSlots = useMemo(() => {
    if (!selectedDate) return []
    return grouped[selectedDate] || []
  }, [selectedDate, grouped])

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-24 text-center">
        <div className="inline-block w-2 h-2 rounded-full bg-gray-400 animate-pulse mr-2"></div>
        <span className="text-gray-600">Loading portfolio…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-24 text-center">
        <h1 className="text-2xl font-bold mb-3 tracking-tight">Unable to load portfolio</h1>
        <p className="text-gray-600 text-sm">Please try again later.</p>
      </div>
    )
  }

  const sections = data?.sections || []

  return (
    <div>
      {sections.length > 0 ? sections.map(renderSection) : (
        <div className="max-w-5xl mx-auto px-6 py-24 text-center">
          <h1 className="text-3xl font-black tracking-tight mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>{data?.page?.title || 'Portfolio'}</h1>
          <p className="text-gray-600">Content is being prepared. Please check back soon.</p>
        </div>
      )}

      <section id="calendar" className="py-20 lg:py-24 bg-slate-50 border-t">
        <div className="max-w-5xl mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center mb-10">
            <h2 className="text-3xl lg:text-4xl font-black tracking-tight mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>Book a meeting</h2>
            <p className="text-gray-600 leading-relaxed">
              Choose a date and time in {TIMEZONE_LABEL}. {slotMinutes}-minute slots, multiple of 15.
              <br />
              <span className="text-xs text-gray-500">Not taking bookings today — from tomorrow • Times in {TIMEZONE_LABEL}</span>
            </p>
          </div>

          {calLoading ? (
            <div className="max-w-md mx-auto text-center py-8">
              <div className="animate-pulse text-sm text-gray-500">Loading calendar…</div>
            </div>
          ) : calError ? (
            <div className="max-w-md mx-auto border border-red-200 bg-red-50 rounded-xl p-4 text-center text-sm text-red-700">
              Calendar unavailable
            </div>
          ) : (
            <div className="w-full">
              <CalendarView grouped={grouped} selectedDate={selectedDate} onDateSelect={(d) => { setSelectedDate(d); setSelectedSlot(null); setBookingResult(null) }} excludeToday={excludeToday} slotMinutes={slotMinutes} />
              <div className="mt-8 w-full max-w-3xl mx-auto space-y-6">
                {selectedDate && !selectedSlot && !bookingResult && (
                  <SlotPicker date={selectedDate} slots={selectedSlots} onSlotSelect={(slot) => setSelectedSlot(slot)} onClose={() => { setSelectedDate(null); setSelectedSlot(null) }} slotMinutes={slotMinutes} />
                )}
                {!selectedDate && !bookingResult && (
                  <div className="text-center text-sm text-gray-500 py-4">
                    Select a date from next 14 days to see available times in {TIMEZONE_LABEL}
                    <div className="text-xs mt-1">{slots.length} slots • {Object.keys(grouped).length} days</div>
                  </div>
                )}
                {selectedSlot && !bookingResult && (
                  <BookingForm
                    slot={selectedSlot}
                    onSuccess={(result) => {
                      setBookingResult(result)
                      refetchCalendar()
                    }}
                    onCancel={() => { setSelectedSlot(null); }}
                  />
                )}
                {bookingResult && (
                  <div className="card rounded-2xl p-6 bg-green-50 border-green-300 text-center">
                    <h3 className="font-black text-xl mb-3">Meeting Confirmed ✅</h3>
                    <p className="text-sm mb-2">{bookingResult.dateTime}</p>
                    <p className="text-sm mb-2">Meet: <a href={bookingResult.meetLink} target="_blank" rel="noopener noreferrer" className="underline">{bookingResult.meetLink}</a></p>
                    {bookingResult.meetLink.includes('fake-') && (
                      <div className="mx-auto max-w-md p-3 border border-amber-300 bg-amber-50 rounded-lg text-xs text-amber-800 mb-3 text-left">
                        <div className="font-semibold">⚠️ Fake Meet link — stub</div>
                        <div>Google Calendar secret or permission issue. Check /api/debug/diag</div>
                        {bookingResult.gcalError && <div className="mt-1 font-mono break-all">{bookingResult.gcalError}</div>}
                      </div>
                    )}
                    {bookingResult.emailResult && !bookingResult.emailResult.success && (
                      <div className="mx-auto max-w-md p-3 border border-orange-300 bg-orange-50 rounded-lg text-xs text-orange-800 mb-3 text-left">
                        <div className="font-semibold">📧 Email not sent</div>
                        <div>{bookingResult.emailResult.error}</div>
                      </div>
                    )}
                    <div className="flex gap-3 justify-center flex-wrap">
                      <button onClick={() => { const ics = generateIcsContent({ title: `Meeting — ${bookingResult.dateTime}`, description: `Meet: ${bookingResult.meetLink}\nCancel: ${bookingResult.cancelUrl}`, location: bookingResult.meetLink, start: selectedSlot?.start || new Date().toISOString(), end: selectedSlot?.end || new Date().toISOString(), meetLink: bookingResult.meetLink }); downloadIcsFile(ics, `meeting-${selectedDate}.ics`); }} className="px-6 py-3 bg-slate-900 text-white rounded-full text-sm font-semibold hover:bg-black leading-none">
                        Download invite (.ics)
                      </button>
                      <a href={bookingResult.cancelUrl} className="px-6 py-3 rounded-full border border-red-200 bg-white text-red-700 text-sm font-semibold hover:bg-red-50 leading-none inline-flex items-center justify-center">
                        Cancel meeting
                      </a>
                    </div>
                    <div className="flex gap-3 justify-center flex-wrap mt-4">
                      <button onClick={() => { setSelectedDate(null); setSelectedSlot(null); setBookingResult(null) }} className="px-6 py-3 bg-black text-white rounded-full text-sm font-semibold leading-none">Book another</button>
                      <a href={bookingResult.meetLink} target="_blank" rel="noopener noreferrer" className="px-6 py-3 bg-white border border-slate-200 rounded-full text-sm font-semibold leading-none inline-flex items-center justify-center">Open Meet →</a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
