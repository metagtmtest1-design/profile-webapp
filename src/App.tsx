import React from 'react'
import { Layout } from './components/common/Layout'
import { Home } from './pages/Home'
import { Health } from './pages/Health'
import { Admin } from './pages/Admin'

function App() {
  const path = typeof window !== 'undefined' ? window.location.pathname : '/'

  // Simple routing — no react-router needed for MVP
  if (path.startsWith('/health')) {
    return <Health />
  }
  if (path.startsWith('/admin')) {
    return (
      <Layout title="Admin">
        <Admin />
      </Layout>
    )
  }

  return (
    <Layout title="Portfolio">
      <Home />
    </Layout>
  )
}

export default App
