import React from 'react'
import type { Section, SectionItem } from '../../lib/api'

export interface TestimonialsProps {
  section: Section
  items: SectionItem[]
}

export function Testimonials({ section, items }: TestimonialsProps) {
  return (
    <section className="py-16 bg-white">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-10">
          <div className="inline-block px-3 py-1 bg-gray-100 rounded-full text-xs font-semibold mb-3">Testimonials</div>
          {section.heading && <h2 className="text-3xl font-black">{section.heading}</h2>}
          {section.subheading && <p className="text-gray-600 mt-2">{section.subheading}</p>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {items.map((item) => (
            <div key={item.id} className="card p-6 bg-gray-50">
              <div className="text-3xl text-gray-300 mb-2">“</div>
              {item.body && <p className="text-gray-800 mb-4 leading-relaxed">"{item.body}"</p>}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">
                  {item.author?.[0] || 'J'}
                </div>
                <div>
                  {item.author && <p className="font-semibold text-sm">{item.author}</p>}
                  {item.title && <p className="text-xs text-gray-500">{item.title}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
        {items.length === 0 && <div className="text-center text-gray-400 py-8">No testimonials yet</div>}
      </div>
    </section>
  )
}
