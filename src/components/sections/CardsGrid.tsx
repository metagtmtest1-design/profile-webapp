import React from 'react'
import type { Section, SectionItem } from '../../lib/api'

export interface CardsGridProps {
  section: Section
  items: SectionItem[]
}

export function CardsGrid({ section, items }: CardsGridProps) {
  return (
    <section className="py-20 lg:py-24 bg-white" id="services">
      <div className="max-w-5xl mx-auto px-6">
        <div className="max-w-2xl mx-auto text-center mb-12">
          {section.heading && <h2 className="text-3xl lg:text-4xl font-black tracking-tight mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>{section.heading}</h2>}
          {section.subheading && <p className="text-gray-600 leading-relaxed">{section.subheading}</p>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {items.map((item, idx) => (
            <div key={item.id} className="card p-8 group">
              <div className="flex items-center justify-between mb-5">
                <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-xl flex-none">
                  <span aria-hidden="true" style={{ fontSize: '22px', lineHeight: 1 }}>{item.icon || ['◈','✦','⬙','◎','◐','✧'][idx % 6]}</span>
                </div>
                <span className="text-xs font-mono text-gray-400">0{idx + 1}</span>
              </div>
              {item.title && <h3 className="font-bold text-[17px] mb-2 tracking-tight">{item.title}</h3>}
              {item.body && <p className="text-gray-600 text-sm leading-relaxed mb-4">{item.body}</p>}
              {item.link_url && (
                <a href={item.link_url} className="text-sm font-semibold inline-flex items-center gap-1 hover:gap-2 transition-all">
                  {item.link_text || 'Learn more'} <span aria-hidden>→</span>
                </a>
              )}
            </div>
          ))}
        </div>
        {items.length === 0 && <div className="text-center text-gray-400 py-8">Services coming soon</div>}
      </div>
    </section>
  )
}
