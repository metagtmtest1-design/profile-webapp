import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import App from './App'

// Mock lib/api
vi.mock('./lib/api', () => ({
  fetchHealth: vi.fn(),
}))

import { fetchHealth } from './lib/api'

describe('App component', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render loading state initially', () => {
    vi.mocked(fetchHealth).mockReturnValue(new Promise(() => {})) // never resolves
    render(<App />)
    expect(screen.getByText(/checking/i)).toBeInTheDocument()
  })

  it('should render health ok badge after fetch', async () => {
    vi.mocked(fetchHealth).mockResolvedValue({
      status: 'ok',
      db: 'ok',
      r2: 'ok',
      timestamp: new Date().toISOString(),
      env: 'test',
      checks: { d1Ms: 2, r2Ms: 3 },
    } as any)

    render(<App />)
    await waitFor(() => {
      // Badge may appear in multiple places (banner + badge), check at least one
      expect(screen.getAllByText(/db: ok/i).length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getAllByText(/r2: ok/i).length).toBeGreaterThanOrEqual(1)
  })

  it('should render error when health fails', async () => {
    vi.mocked(fetchHealth).mockRejectedValue(new Error('D1 connection failed'))

    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/D1 connection failed/)).toBeInTheDocument()
  })

  it('should render R2 sample image when url provided', async () => {
    vi.mocked(fetchHealth).mockResolvedValue({
      status: 'ok',
      db: 'ok',
      r2: 'ok',
      timestamp: new Date().toISOString(),
      env: 'test',
      checks: { d1Ms: 2, r2Ms: 3 },
      sampleImageUrl: 'https://example.com/r2/test.jpg',
    } as any)

    render(<App />)
    await waitFor(() => {
      expect(screen.getAllByText(/db: ok/i).length).toBeGreaterThanOrEqual(1)
    })
    // Image should be present if sampleImageUrl exists — query img element
    await waitFor(() => {
      const img = document.querySelector('img') as HTMLImageElement
      expect(img).toBeTruthy()
      expect(img.src).toContain('example.com')
    })
  })

  it('should show ENVIRONMENT banner when not production', async () => {
    vi.mocked(fetchHealth).mockResolvedValue({
      status: 'ok',
      db: 'ok',
      r2: 'ok',
      timestamp: new Date().toISOString(),
      env: 'alpha',
      checks: { d1Ms: 2, r2Ms: 3 },
      sampleImageUrl: 'https://example.com/img.jpg',
    } as any)

    render(<App />)
    // Wait for health to load first (DB ok)
    await waitFor(() => {
      expect(screen.getAllByText(/db: ok/i).length).toBeGreaterThanOrEqual(1)
    })
    // Then check for alpha banner — should be present as [ALPHA] or BOLD ALPHA
    expect(screen.getAllByText(/ALPHA/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/BOLD ALPHA ENV/i)).toBeInTheDocument()
  })

  it('should show bold production banner when env=production (merged PR)', async () => {
    vi.mocked(fetchHealth).mockResolvedValue({
      status: 'ok',
      db: 'ok',
      r2: 'ok',
      timestamp: new Date().toISOString(),
      env: 'production',
      checks: { d1Ms: 2, r2Ms: 3 },
    } as any)

    render(<App />)
    await waitFor(() => {
      expect(screen.getAllByText(/db: ok/i).length).toBeGreaterThanOrEqual(1)
    })
    // Now prod also shows bold banner (green) — verifies prod deploy after merge
    expect(screen.getAllByText(/PRODUCTION/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/BOLD PRODUCTION ENV/i)).toBeInTheDocument()
    expect(screen.getByText(/PROD — bold green proves merge/i)).toBeInTheDocument()
    // Should NOT show ALPHA when prod
    expect(screen.queryByText(/\[ALPHA\]/i)).not.toBeInTheDocument()
  })
})
