import React from 'react'
import type { Section, SectionItem } from '../../lib/api'

export interface TestimonialsProps {
  section: Section
  items: SectionItem[]
}

export function Testimonials({ section, items }: TestimonialsProps) {
  return (
    <section className="py-12">
      <div className="max-w-5xl mx-auto px-6">
        {section.heading && <h2 className="text-3xl font-bold mb-8 text-center">{section.heading}</h2>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {items.map((item) => (
            <div key={item.id} className="border rounded-lg p-6 bg-white">
              {item.body && <p className="text-gray-700 italic mb-3">"{item.body}"</p>}
              {item.author && <p className="font-semibold text-sm">— {item.author}</p>}
              {item.title && <p className="text-xs text-gray-500">{item.title}</p>}
            </div>
          ))}
        </div>
        {items.length === 0 && <div className="text-center text-gray-400">No testimonials yet</div>}
      </div>
    </section>
  )
}
