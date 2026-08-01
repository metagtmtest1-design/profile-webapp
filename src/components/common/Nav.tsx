import React from 'react'
import { useContent } from '../../hooks/useContent'

export interface NavProps {
  title?: string
}

const SECTION_TYPE_TO_NAV: Record<string, { label: string; href: string }> = {
  'cards-grid': { label: 'Services', href: '#services' },
  'text-block': { label: 'About', href: '#about' },
  'testimonials': { label: 'Testimonials', href: '#testimonials' },
  // Calendar is separate component, always show
  // Contact is footer/cta, always show
}

export function Nav({ title = 'Portfolio' }: NavProps) {
  const { data } = useContent('home')
  const visibleTypes = new Set((data?.sections || []).map((s: any) => s.type))

  // Build nav items based on visible sections + always calendar and contact
  // "Contact" used to point at the footer, which on a short page cannot scroll to the
  // top of the viewport — visitors landed mid-way through the booking-lookup form
  // instead. Booking is the contact route, so it is named as such and listed once.
  const navItems: { label: string; href: string; show: boolean }[] = [
    { label: 'Services', href: '#services', show: visibleTypes.has('cards-grid') },
    { label: 'About', href: '#about', show: visibleTypes.has('text-block') },
    { label: 'Testimonials', href: '#testimonials', show: visibleTypes.has('testimonials') },
    { label: 'Book a free call', href: '#calendar', show: true },
  ]

  const visibleNav = navItems.filter((it) => it.show)

  return (
    <nav className="border-b bg-white sticky top-0 z-10" role="banner" aria-label="Main navigation">
      <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center gap-4">
        <div className="font-black text-xl tracking-tight flex-none" style={{ fontFamily: 'Playfair Display, serif' }}>{title}</div>
        {/* One row at every width. Below 640px the section links wrapped under the
            wordmark and the sticky bar grew to 137px — 16% of a phone screen — so only
            the primary action is kept; the sections are a scroll away regardless. */}
        <div className="flex items-center gap-4 sm:gap-6 text-sm font-semibold justify-end" role="navigation">
          {visibleNav.filter((i) => i.href !== '#calendar').map((item) => (
            <a key={item.href} href={item.href} className="hidden sm:inline-flex hover:underline focus:outline-none focus:underline items-center min-h-11 px-1">
              {item.label}
            </a>
          ))}
          <a href="#calendar" className="inline-flex items-center min-h-11 px-4 rounded-full bg-slate-900 text-white whitespace-nowrap">
            Book a free call
          </a>
        </div>
      </div>
    </nav>
  )
}
