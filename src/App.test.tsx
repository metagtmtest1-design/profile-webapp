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
      expect(screen.getByText(/db: ok/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/r2: ok/i)).toBeInTheDocument()
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
      expect(screen.getByText(/db: ok/i)).toBeInTheDocument()
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
      expect(screen.getByText(/db: ok/i)).toBeInTheDocument()
    })
    // Then check for alpha banner — should be present as [ALPHA] or env: alpha
    expect(screen.getByText(/\[ALPHA\]/i)).toBeInTheDocument()
  })

  it('should not show alpha banner when production', async () => {
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
      expect(screen.getByText(/db: ok/i)).toBeInTheDocument()
    })
    // Should NOT show ALPHA or PREVIEW banner text when prod
    expect(screen.queryByText(/\[ALPHA\]/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/\[PREVIEW\]/i)).not.toBeInTheDocument()
  })
})
