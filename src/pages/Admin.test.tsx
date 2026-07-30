import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Admin } from './Admin'

const mockUseAdminAuth = vi.fn()
vi.mock('../hooks/useAdminAuth', () => ({
  useAdminAuth: (...args: any[]) => mockUseAdminAuth(...args),
}))

const mockUseAdminContent = vi.fn()
vi.mock('../hooks/useAdminContent', () => ({
  useAdminContent: (...args: any[]) => mockUseAdminContent(...args),
}))

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<any>('../lib/api')
  return {
    ...actual,
    fetchR2Usage: vi.fn().mockResolvedValue({ totalObjects: 0, totalMB: 0, percent: 0, warning: false, truncated: false, limitMB: 10240, guidance: 'safe' }),
  }
})

describe('Admin page — Cloudflare Zero Trust Google login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAdminContent.mockReturnValue({
      sections: [],
      loading: false,
      error: null,
      updateSection: vi.fn(),
      updateItem: vi.fn(),
      reorderSections: vi.fn(),
      reorderItems: vi.fn(),
      refetch: vi.fn(),
    })
  })

  it('shows loading state', () => {
    mockUseAdminAuth.mockReturnValue({
      data: null,
      loading: true,
      error: null,
      isAuthed: false,
      isBypass: false,
      email: null,
      refetch: vi.fn(),
    })
    render(<Admin />)
    expect(screen.getByText(/Checking admin access/i)).toBeInTheDocument()
  })

  it('shows access required when not authed (401)', () => {
    mockUseAdminAuth.mockReturnValue({
      data: { authed: false, error: 'Missing Cloudflare Access JWT' },
      loading: false,
      error: 'Missing Cloudflare Access JWT',
      isAuthed: false,
      isBypass: false,
      email: null,
      refetch: vi.fn(),
    })
    render(<Admin />)
    expect(screen.getByText(/Passwordless Google Login/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Cloudflare Zero Trust/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/no password form anywhere/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Passwordless flow/i)).toBeInTheDocument()
  })

  it('shows admin dashboard when authed via bypass local', async () => {
    mockUseAdminAuth.mockReturnValue({
      data: { authed: true, email: 'bypass@local', bypass: true, env: 'local', allowlistConfigured: false },
      loading: false,
      error: null,
      isAuthed: true,
      isBypass: true,
      email: 'bypass@local',
      refetch: vi.fn(),
    })
    render(<Admin />)
    expect(screen.getByText(/Admin Dashboard/i)).toBeInTheDocument()
    expect(screen.getAllByText(/bypass@local/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Bypass Mode/i)).toBeInTheDocument()
  })

  it('shows admin dashboard when authed via real Google JWT', () => {
    mockUseAdminAuth.mockReturnValue({
      data: { authed: true, email: 'admin@example.com', bypass: false, env: 'production', allowlistConfigured: true },
      loading: false,
      error: null,
      isAuthed: true,
      isBypass: false,
      email: 'admin@example.com',
      refetch: vi.fn(),
    })
    render(<Admin />)
    expect(screen.getByText(/Admin Dashboard/i)).toBeInTheDocument()
    expect(screen.getAllByText(/admin@example.com/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Bypass Mode/i)).not.toBeInTheDocument()
  })

  it('shows free tier upload strategy note', () => {
    mockUseAdminAuth.mockReturnValue({
      data: { authed: true, email: 'admin@example.com', bypass: false, env: 'production', allowlistConfigured: true },
      loading: false,
      error: null,
      isAuthed: true,
      isBypass: false,
      email: 'admin@example.com',
      refetch: vi.fn(),
    })
    render(<Admin />)
    expect(screen.getByText(/Free Tier Safety.*100 Images/i)).toBeInTheDocument()
    expect(screen.getAllByText(/PNG if.*1MB.*WebP/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Replace-on-update/i)).toBeInTheDocument()
    expect(screen.getByText(/alpha\+prod/i)).toBeInTheDocument()
  })

  it('shows passwordless Google login explicitly no password form', () => {
    mockUseAdminAuth.mockReturnValue({
      data: { authed: true, email: 'admin@example.com', bypass: false, env: 'production', allowlistConfigured: true },
      loading: false,
      error: null,
      isAuthed: true,
      isBypass: false,
      email: 'admin@example.com',
      refetch: vi.fn(),
    })
    render(<Admin />)
    expect(screen.getAllByText(/Passwordless Google Login/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/No password field anywhere/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/passwordless/i).length).toBeGreaterThan(0)
  })
})
