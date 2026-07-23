import React from 'react'
import type { Section, SectionItem } from '../../lib/api'

export interface CTABannerProps {
  section: Section
  items: SectionItem[]
}

export function CTABanner({ section, items }: CTABannerProps) {
  const first = items[0]
  return (
    <section className="py-20 bg-slate-900 text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-30" aria-hidden="true" style={{ background: 'radial-gradient(800px 400px at 20% 10%, #334155 0%, transparent 60%), radial-gradient(600px 300px at 80% 90%, #1e293b 0%, transparent 50%)' }}></div>
      <div className="max-w-5xl mx-auto px-6 text-center relative">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs font-medium mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
          Available for new projects
        </div>
        {section.heading && <h2 className="text-3xl lg:text-4xl font-black tracking-tight mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>{section.heading}</h2>}
        {first?.title && <h3 className="text-lg text-slate-200 font-medium mb-3">{first.title}</h3>}
        {first?.body && <p className="text-slate-300 mb-8 max-w-2xl mx-auto leading-relaxed">{first.body}</p>}
        <div className="flex gap-4 justify-center flex-wrap">
          {first?.link_url && (
            <a href={first.link_url} className="inline-flex items-center gap-2 px-8 py-4 bg-white text-slate-900 rounded-full font-bold hover:bg-slate-100 shadow-lg focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-900 leading-none">
              {first.link_text || 'Book a free call'} <span aria-hidden>→</span>
            </a>
          )}
          <a href="#services" className="inline-flex items-center gap-2 px-8 py-4 rounded-full border border-white/20 text-white font-semibold hover:bg-white/10 leading-none">Explore services</a>
        </div>
      </div>
    </section>
  )
}
