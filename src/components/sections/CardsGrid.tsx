import React from 'react'
import type { Section, SectionItem } from '../../lib/api'

export interface CardsGridProps {
  section: Section
  items: SectionItem[]
}

export function CardsGrid({ section, items }: CardsGridProps) {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-5xl mx-auto px-6">
        {(section.heading || section.subheading) && (
          <div className="text-center mb-12">
            {section.heading && <h2 className="text-3xl font-black mb-3 tracking-tight">{section.heading}</h2>}
            {section.subheading && <p className="text-gray-600 max-w-2xl mx-auto">{section.subheading}</p>}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {items.map((item) => (
            <div key={item.id} className="card p-6 bg-white shadow-sm hover:shadow-md group">
              <div className="w-14 h-14 rounded-xl bg-gray-50 border flex-none flex items-center justify-center text-2xl mb-5">
                <span aria-hidden="true">{item.icon || '✦'}</span>
              </div>
              {item.title && <h3 className="font-bold text-lg mb-2">{item.title}</h3>}
              {item.body && <p className="text-gray-600 text-sm leading-relaxed">{item.body}</p>}
              {item.link_url && (
                <a href={item.link_url} className="text-sm font-semibold underline hover:no-underline mt-4 inline-block">
                  {item.link_text || 'Explore →'}
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
