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
  const navItems: { label: string; href: string; show: boolean }[] = [
    { label: 'Services', href: '#services', show: visibleTypes.has('cards-grid') },
    { label: 'About', href: '#about', show: visibleTypes.has('text-block') },
    { label: 'Testimonials', href: '#testimonials', show: visibleTypes.has('testimonials') },
    { label: 'Calendar', href: '#calendar', show: true },
    { label: 'Contact', href: '#contact', show: true },
  ]

  const visibleNav = navItems.filter((it) => it.show)

  return (
    <nav className="border-b bg-white sticky top-0 z-10" aria-label="Main navigation">
      <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center gap-4">
        <div className="font-black text-xl tracking-tight flex-none" style={{ fontFamily: 'Playfair Display, serif' }}>{title}</div>
        <div className="flex gap-4 sm:gap-6 text-sm font-semibold flex-wrap justify-end" role="navigation">
          {visibleNav.map((item) => (
            <a key={item.href} href={item.href} className="hover:underline focus:outline-none focus:underline" aria-label={item.label}>
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  )
}
