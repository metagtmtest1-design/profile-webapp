import React from 'react'
import { Nav } from './Nav'
import { Footer } from './Footer'

export interface LayoutProps {
  children: React.ReactNode
  title?: string
}

export function Layout({ children, title }: LayoutProps) {
  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      <Nav title={title} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
