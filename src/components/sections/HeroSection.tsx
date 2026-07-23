import React from 'react'
import type { Section, SectionItem } from '../../lib/api'

export interface HeroSectionProps {
  section: Section
  items: SectionItem[]
}

export function HeroSection({ section, items }: HeroSectionProps) {
  const first = items[0]
  return (
    <section className="hero py-16 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row gap-8 items-center">
        <div className="flex-1">
          <h1 className="text-4xl font-black mb-2">{section.heading || first?.title || 'Welcome'}</h1>
          {section.subheading && <h2 className="text-xl text-gray-600 mb-4">{section.subheading}</h2>}
          {first?.body && <p className="text-gray-700 mb-6">{first.body}</p>}
          {first?.link_url && (
            <a href={first.link_url} className="inline-block px-6 py-3 bg-black text-white rounded hover:bg-gray-800">
              {first.link_text || 'Learn More'}
            </a>
          )}
        </div>
        <div className="flex-1">
          {first?.image_url ? (
            <img src={first.image_url} alt={first.title || section.heading || 'Hero'} className="w-full rounded shadow-lg object-cover h-64 md:h-80" loading="lazy" />
          ) : (
            <div className="w-full h-64 bg-gray-100 rounded flex items-center justify-center text-gray-400">No image</div>
          )}
        </div>
      </div>
    </section>
  )
}
