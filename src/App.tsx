import React from 'react'
import { Layout } from './components/common/Layout'
import { Home } from './pages/Home'
import { Health } from './pages/Health'
import { Admin } from './pages/Admin'
import { debug } from './lib/debug'

function App() {
  const path = typeof window !== 'undefined' ? window.location.pathname : '/'
  debug('!!! APP_ROUTING path=' + path)

  React.useEffect(() => {
    document.title = path.startsWith('/admin')
      ? 'Edit your site — Portfolio'
      : path.startsWith('/health')
        ? 'System health — Portfolio'
        : 'Portfolio — Strategic brand design & development'
  }, [path])

  // Simple routing — no react-router needed for MVP
  if (path.startsWith('/health')) {
    return <Health />
  }
  // Admin ships its own sticky toolbar — the public Nav would stack a second
  // sticky bar on top of it and expose #about/#calendar anchors that only exist
  // on the landing page.
  if (path.startsWith('/admin')) {
    return <Admin />
  }

  return (
    <Layout title="Portfolio">
      <Home />
    </Layout>
  )
}

export default App
