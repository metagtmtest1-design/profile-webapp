import React from 'react'

export interface NavProps {
  title?: string
}

export function Nav({ title = 'Portfolio' }: NavProps) {
  return (
    <nav className="border-b bg-white sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center gap-4">
        <div className="font-black text-xl tracking-tight flex-none" style={{ fontFamily: 'Playfair Display, serif' }}>{title}</div>
        <div className="flex gap-4 sm:gap-6 text-sm font-semibold flex-wrap justify-end">
          <a href="#services" className="hover:underline focus:outline-none focus:underline">Services</a>
          <a href="#about" className="hover:underline focus:outline-none focus:underline">About</a>
          <a href="#testimonials" className="hover:underline hidden sm:inline focus:outline-none focus:underline">Testimonials</a>
          <a href="#calendar" className="hover:underline focus:outline-none focus:underline">Calendar</a>
          <a href="#contact" className="hover:underline focus:outline-none focus:underline">Contact</a>
        </div>
      </div>
    </nav>
  )
}
