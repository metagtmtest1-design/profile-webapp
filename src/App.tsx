import React from 'react'
import { Layout } from './components/common/Layout'
import { Home } from './pages/Home'
import { Health } from './pages/Health'

function App() {
  const path = typeof window !== 'undefined' ? window.location.pathname : '/'

  // Simple routing — no react-router needed for MVP
  if (path.startsWith('/health')) {
    return <Health />
  }

  return (
    <Layout title="Portfolio">
      <Home />
    </Layout>
  )
}

export default App
