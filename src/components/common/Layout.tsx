import React from 'react'
import { Nav } from './Nav'
import { Footer } from './Footer'
import { EnvBanner } from '../EnvBanner'

export interface LayoutProps {
  children: React.ReactNode
  env?: string
  title?: string
}

export function Layout({ children, env, title }: LayoutProps) {
  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      {env && <EnvBanner env={env} />}
      <Nav title={title} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
