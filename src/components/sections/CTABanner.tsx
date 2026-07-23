import React from 'react'
import type { Section, SectionItem } from '../../lib/api'

export interface CTABannerProps {
  section: Section
  items: SectionItem[]
}

export function CTABanner({ section, items }: CTABannerProps) {
  const first = items[0]
  return (
    <section className="py-10 bg-black text-white">
      <div className="max-w-5xl mx-auto px-6 text-center">
        {section.heading && <h2 className="text-2xl font-bold mb-2">{section.heading}</h2>}
        {first?.title && <h3 className="text-xl mb-2">{first.title}</h3>}
        {first?.body && <p className="text-gray-300 mb-4">{first.body}</p>}
        {first?.link_url && (
          <a href={first.link_url} className="inline-block px-6 py-3 bg-white text-black rounded font-bold hover:bg-gray-100">
            {first.link_text || 'Get Started'}
          </a>
        )}
      </div>
    </section>
  )
}
