import React from 'react'
import type { Section, SectionItem } from '../../lib/api'

export interface CTABannerProps {
  section: Section
  items: SectionItem[]
}

export function CTABanner({ section, items }: CTABannerProps) {
  const first = items[0]
  return (
    <section className="py-16 bg-black text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-black opacity-60" aria-hidden="true"></div>
      <div className="max-w-5xl mx-auto px-6 text-center relative">
        {section.heading && <h2 className="text-3xl font-black mb-4 tracking-tight">{section.heading}</h2>}
        {first?.title && <h3 className="text-xl font-semibold mb-3">{first.title}</h3>}
        {first?.body && <p className="text-gray-300 mb-8 max-w-2xl mx-auto">{first.body}</p>}
        {first?.link_url && (
          <a href={first.link_url} className="inline-block px-8 py-3 bg-white text-black rounded-lg font-black hover:bg-gray-100 shadow-lg focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black">
            {first.link_text || 'Book a Call →'}
          </a>
        )}
      </div>
    </section>
  )
}
