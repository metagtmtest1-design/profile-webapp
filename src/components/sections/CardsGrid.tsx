import React from 'react'
import type { Section, SectionItem } from '../../lib/api'

export interface CardsGridProps {
  section: Section
  items: SectionItem[]
}

export function CardsGrid({ section, items }: CardsGridProps) {
  return (
    <section className="py-12 bg-white">
      <div className="max-w-5xl mx-auto px-6">
        {(section.heading || section.subheading) && (
          <div className="text-center mb-8">
            <div className="inline-block px-3 py-1 bg-black text-white rounded-full text-xs font-semibold mb-3">Services</div>
            {section.heading && <h2 className="text-3xl font-black mb-3">{section.heading}</h2>}
            {section.subheading && <p className="text-gray-600 max-w-2xl mx-auto">{section.subheading}</p>}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {items.map((item) => (
            <div key={item.id} className="card p-6 bg-white shadow-sm hover:shadow-md group">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xl mb-4 group-hover:bg-black group-hover:text-white transition-shadow">
                {item.icon || '✦'}
              </div>
              {item.title && <h3 className="font-bold text-lg mb-2">{item.title}</h3>}
              {item.body && <p className="text-gray-600 text-sm mb-3">{item.body}</p>}
              {item.link_url && (
                <a href={item.link_url} className="text-sm font-semibold underline hover:no-underline">
                  {item.link_text || 'Explore →'}
                </a>
              )}
            </div>
          ))}
        </div>
        {items.length === 0 && <div className="text-center text-gray-400 py-8">No services yet — add in D1 seeder or admin</div>}
      </div>
    </section>
  )
}
