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
import { useCalendar } from '../hooks/useCalendar'
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
  const { slots, grouped, loading: calLoading, error: calError, slotMinutes, excludeToday } = useCalendar(2)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

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

      {/* Slice 2: Calendar Slots — real from Google Calendar FreeBusy (or stub when no creds) */}
      <section id="calendar" className="py-20 lg:py-24 bg-slate-50 border-t">
        <div className="max-w-5xl mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center mb-10">
            <h2 className="text-3xl lg:text-4xl font-black tracking-tight mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>Book a meeting</h2>
            <p className="text-gray-600 leading-relaxed">
              Choose a date and available time. {slotMinutes}-minute intro call (configurable multiple of 15), no pitch — just practical next steps.
              <br />
              <span className="text-xs text-gray-500">
                Working hours 09:00-17:00 Mon-Fri, {slotMinutes} min slots, {excludeToday ? 'excluding today' : 'including today'} — slots exclude busy from booking and personal calendars (privacy: only free/busy, no details).
              </span>
            </p>
          </div>

          {calLoading ? (
            <div className="max-w-md mx-auto text-center py-8">
              <div className="animate-pulse text-sm text-gray-500">Loading calendar slots…</div>
            </div>
          ) : calError ? (
            <div className="max-w-md mx-auto border border-red-200 bg-red-50 rounded-xl p-4 text-center text-sm text-red-700">
              <div>Calendar unavailable</div>
              <div className="text-xs mt-1">{calError}</div>
            </div>
          ) : (
            <div className="w-full">
              <CalendarView grouped={grouped} selectedDate={selectedDate} onDateSelect={setSelectedDate} excludeToday={excludeToday} slotMinutes={slotMinutes} />
              <div className="mt-8 w-full max-w-3xl mx-auto">
                {selectedDate ? (
                  <SlotPicker
                    date={selectedDate}
                    slots={selectedSlots}
                    onSlotSelect={(slot) => {
                      // Slice 3 will handle booking
                    }}
                    slotMinutes={slotMinutes}
                  />
                ) : (
                  <div className="text-center text-sm text-gray-500 py-4">
                    <div>Select a date above to see available times</div>
                    <div className="text-xs mt-1">
                      {excludeToday ? 'Excluding today • ' : ''}{slots.length} slots • {Object.keys(grouped).length} days
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-8 text-center text-xs text-gray-500">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-white border rounded-full">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              {slots.length} slots next 14 days (from {excludeToday ? 'tomorrow' : 'today'}) • {slotMinutes} min each • Configurable multiple of 15
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}
