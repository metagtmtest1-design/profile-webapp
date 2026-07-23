import React from 'react'
import type { Section, SectionItem } from '../../lib/api'

export interface HeroSectionProps {
  section: Section
  items: SectionItem[]
}

export function HeroSection({ section, items }: HeroSectionProps) {
  const first = items[0]
  return (
    <section className="hero py-20 lg:py-24">
      <div className="max-w-5xl mx-auto px-6 flex flex-col lg:flex-row gap-12 lg:gap-16 items-center relative">
        <div className="flex-1 w-full">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-gray-500 mb-5">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
            Available for new projects • Boston-based, global clients
          </div>
          <h1 className="text-4xl lg:text-5xl font-black mb-5 tracking-tight leading-tight" style={{ fontFamily: 'Playfair Display, serif' }}>
            {section.heading || 'Strategic branding that drives growth'}
          </h1>
          {section.subheading && <p className="text-xl text-gray-600 mb-6 leading-relaxed max-w-[60ch]">{section.subheading}</p>}
          {first?.body && <p className="text-gray-600 mb-8 leading-relaxed max-w-[60ch]">{first.body}</p>}
          <div className="flex gap-3 flex-wrap items-center">
            {first?.link_url && (
              <a href={first.link_url} className="btn-primary">
                {first.link_text || 'Book a free call'} <span aria-hidden>→</span>
              </a>
            )}
            <a href="#services" className="btn-secondary">View services</a>
            <span className="text-xs text-gray-400 ml-2 hidden sm:inline">Trusted by 50+ founders • 4.9/5 rating</span>
          </div>
          <div className="mt-10 flex gap-8 text-sm border-t pt-6">
            <div><div className="font-black text-xl">10+</div><div className="text-gray-500 text-xs">Years experience</div></div>
            <div><div className="font-black text-xl">120+</div><div className="text-gray-500 text-xs">Projects shipped</div></div>
            <div><div className="font-black text-xl">98%</div><div className="text-gray-500 text-xs">Client retention</div></div>
          </div>
        </div>
        <div className="flex-1 w-full">
          {first?.image_url ? (
            <div className="relative">
              <div className="absolute -inset-3 bg-slate-50 rounded-2xl -z-10 rotate-1"></div>
              <img src={first.image_url} alt={first.title || 'Brand strategy hero'} className="w-full rounded-2xl shadow-lg object-cover aspect-[4/3] h-auto" loading="lazy" decoding="async" />
              <div className="absolute -bottom-6 -left-6 bg-white border rounded-xl shadow-md p-4 hidden lg:flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center text-sm font-bold">✓</div>
                <div className="text-sm"><div className="font-semibold">Conversion focused</div><div className="text-xs text-gray-500">Designs that convert visitors</div></div>
              </div>
            </div>
          ) : (
            <div className="w-full aspect-[4/3] bg-slate-50 border rounded-2xl flex items-center justify-center text-gray-400">Illustration</div>
          )}
        </div>
      </div>
    </section>
  )
}
