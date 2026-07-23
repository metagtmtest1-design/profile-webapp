import React from 'react'
import type { Section, SectionItem } from '../../lib/api'

export interface HeroSectionProps {
  section: Section
  items: SectionItem[]
}

export function HeroSection({ section, items }: HeroSectionProps) {
  const first = items[0]
  return (
    <section className="hero py-20">
      <div className="max-w-5xl mx-auto px-6 flex flex-col lg:flex-row gap-12 lg:gap-16 items-center">
        <div className="flex-1 w-full">
          <h1 className="text-4xl font-black mb-4 tracking-tight" style={{ lineHeight: '1.1', fontFamily: 'Playfair Display, serif' }}>
            {section.heading || first?.title || 'Branding and more services'}
          </h1>
          {section.subheading && <p className="text-xl text-gray-600 mb-5 leading-relaxed">{section.subheading}</p>}
          {first?.body && <p className="text-gray-700 mb-8 text-lg leading-relaxed max-w-[60ch]">{first.body}</p>}
          <div className="flex gap-3 flex-wrap">
            {first?.link_url && (
              <a href={first.link_url} className="inline-block px-6 py-3 bg-black text-white rounded-lg font-bold hover:bg-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2">
                {first.link_text || 'Get Started'}
              </a>
            )}
            <a href="#services" className="inline-block px-6 py-3 border rounded-lg font-semibold hover:bg-gray-50 focus:outline-none focus:ring-2">
              Explore services
            </a>
          </div>
        </div>
        <div className="flex-1 w-full">
          {first?.image_url ? (
            <div className="relative">
              <div className="absolute -top-3 -left-3 w-full h-full bg-gray-100 rounded-xl -z-10" aria-hidden="true"></div>
              <img src={first.image_url} alt={first.title ? `${first.title} — hero illustration` : 'Hero illustration'} className="w-full rounded-xl shadow-lg object-cover aspect-[4/3] h-auto" loading="lazy" decoding="async" />
            </div>
          ) : (
            <div className="w-full aspect-[4/3] bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">Illustration</div>
          )}
        </div>
      </div>
    </section>
  )
}
