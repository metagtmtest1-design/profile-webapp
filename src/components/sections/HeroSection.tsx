import React from 'react'
import type { Section, SectionItem } from '../../lib/api'

export interface HeroSectionProps {
  section: Section
  items: SectionItem[]
}

export function HeroSection({ section, items }: HeroSectionProps) {
  const first = items[0]
  return (
    <section className="hero py-16">
      <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row gap-8 items-center">
        <div className="flex-1">
          <div className="inline-block px-3 py-1 bg-gray-100 rounded-full text-xs font-semibold mb-4">Available for new projects</div>
          <h1 className="text-4xl font-black mb-3" style={{ lineHeight: '1.1' }}>
            {section.heading || first?.title || 'Branding and more services'}
          </h1>
          {section.subheading && <h2 className="text-xl text-gray-600 mb-4">{section.subheading}</h2>}
          {first?.body && <p className="text-gray-700 mb-6 text-lg">{first.body}</p>}
          <div className="flex gap-3 flex-wrap">
            {first?.link_url && (
              <a href={first.link_url} className="inline-block px-6 py-3 bg-black text-white rounded-lg font-bold hover:bg-gray-800 transition-shadow shadow-sm">
                {first.link_text || 'Get Started'}
              </a>
            )}
            <a href="#about" className="inline-block px-6 py-3 border rounded-lg font-semibold hover:bg-gray-50">
              Learn more
            </a>
          </div>
        </div>
        <div className="flex-1">
          {first?.image_url ? (
            <div className="relative">
              <div className="absolute -top-4 -left-4 w-full h-full bg-gray-100 rounded-xl -z-10 rotate-1"></div>
              <img src={first.image_url} alt={first.title || section.heading || 'Hero'} className="w-full rounded-xl shadow-lg object-cover h-64 md:h-80" loading="lazy" />
            </div>
          ) : (
            <div className="w-full h-64 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">No image</div>
          )}
        </div>
      </div>
    </section>
  )
}
