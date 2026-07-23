import React from 'react'
import type { Section, SectionItem } from '../../lib/api'

export interface ImageGalleryProps {
  section: Section
  items: SectionItem[]
}

export function ImageGallery({ section, items }: ImageGalleryProps) {
  return (
    <section className="py-12">
      <div className="max-w-5xl mx-auto px-6">
        {section.heading && <h2 className="text-3xl font-bold mb-6 text-center">{section.heading}</h2>}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {items.map((item) => (
            <div key={item.id} className="group">
              {item.image_url ? (
                <img src={item.image_url} alt={item.title || 'Gallery'} className="w-full h-48 object-cover rounded hover:opacity-80" loading="lazy" />
              ) : (
                <div className="w-full h-48 bg-gray-100 rounded flex items-center justify-center text-gray-400">No image</div>
              )}
              {(item.title || item.body) && (
                <div className="mt-2">
                  {item.title && <p className="font-semibold text-sm">{item.title}</p>}
                  {item.body && <p className="text-xs text-gray-600">{item.body}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
        {items.length === 0 && <div className="text-center text-gray-400">No images yet</div>}
      </div>
    </section>
  )
}
