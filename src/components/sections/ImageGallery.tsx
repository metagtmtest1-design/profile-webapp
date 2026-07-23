import React from 'react'
import type { Section, SectionItem } from '../../lib/api'

export interface ImageGalleryProps {
  section: Section
  items: SectionItem[]
}

export function ImageGallery({ section, items }: ImageGalleryProps) {
  return (
    <section className="py-12 bg-gray-50">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-8">
          <div className="inline-block px-3 py-1 bg-white border rounded-full text-xs font-semibold mb-3">Selected Work</div>
          {section.heading && <h2 className="text-3xl font-black mb-2">{section.heading}</h2>}
          {section.subheading && <p className="text-gray-600">{section.subheading}</p>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {items.map((item) => (
            <div key={item.id} className="group card overflow-hidden bg-white">
              <div className="overflow-hidden">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.title || 'Work'} className="w-full h-56 object-cover group-hover:scale-105 transition-shadow duration-200" loading="lazy" />
                ) : (
                  <div className="w-full h-56 bg-gray-100 flex items-center justify-center text-gray-400">No image</div>
                )}
              </div>
              {(item.title || item.body) && (
                <div className="p-4">
                  {item.title && <p className="font-bold text-sm mb-1">{item.title}</p>}
                  {item.body && <p className="text-xs text-gray-600">{item.body}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
        {items.length === 0 && <div className="text-center text-gray-400 py-8">No work yet — add images in R2 + D1</div>}
      </div>
    </section>
  )
}
