import React from 'react'
import type { Section, SectionItem } from '../../lib/api'

export interface CardsGridProps {
  section: Section
  items: SectionItem[]
}

export function CardsGrid({ section, items }: CardsGridProps) {
  return (
    <section className="py-12">
      <div className="max-w-5xl mx-auto px-6">
        {(section.heading || section.subheading) && (
          <div className="text-center mb-8">
            {section.heading && <h2 className="text-3xl font-bold mb-2">{section.heading}</h2>}
            {section.subheading && <p className="text-gray-600">{section.subheading}</p>}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {items.map((item) => (
            <div key={item.id} className="border rounded-lg p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
              {item.icon && <div className="text-2xl mb-3">{item.icon}</div>}
              {item.title && <h3 className="font-bold text-lg mb-2">{item.title}</h3>}
              {item.body && <p className="text-gray-600 text-sm">{item.body}</p>}
              {item.link_url && (
                <a href={item.link_url} className="text-black underline text-sm mt-3 inline-block">
                  {item.link_text || 'Learn more'}
                </a>
              )}
            </div>
          ))}
        </div>
        {items.length === 0 && <div className="text-center text-gray-400">No services yet</div>}
      </div>
    </section>
  )
}
