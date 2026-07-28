import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Admin } from './Admin'

const mockUseAdminAuth = vi.fn()
vi.mock('../hooks/useAdminAuth', () => ({
  useAdminAuth: (...args: any[]) => mockUseAdminAuth(...args),
}))

describe('Admin page — Cloudflare Zero Trust Google login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    expect(screen.getByText(/Admin Access Required/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Cloudflare Zero Trust/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Google login only, no password/i)).toBeInTheDocument()
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
    expect(screen.getByText(/Free Tier Safety/i)).toBeInTheDocument()
    expect(screen.getByText(/Client resize: max 1200px/i)).toBeInTheDocument()
    expect(screen.getByText(/Replace-on-update/i)).toBeInTheDocument()
  })
})
