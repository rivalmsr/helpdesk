import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { useSession } from '@/lib/auth-client'
import { ThemeProvider } from '@/lib/theme'
import NavBar from './NavBar'

// NavBar chooses which links to show from the session role; mock the auth hook
// so each test can render as a given user. useNavigate/Link come from the real
// react-router, satisfied by the MemoryRouter wrapper.
vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
}))

const mockedUseSession = vi.mocked(useSession)

type SessionUser = { name: string; role: 'admin' | 'agent' }

const admin: SessionUser = { name: 'Ada Admin', role: 'admin' }
const agent: SessionUser = { name: 'Aggie Agent', role: 'agent' }

const renderNavBarAs = (user: SessionUser) => {
  mockedUseSession.mockReturnValue({
    data: { user },
  } as unknown as ReturnType<typeof useSession>)
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <NavBar />
      </MemoryRouter>
    </ThemeProvider>,
  )
}

beforeEach(() => {
  mockedUseSession.mockReset()
})

describe('NavBar', () => {
  it('shows the Users link for an admin', () => {
    renderNavBarAs(admin)

    const nav = screen.getByRole('navigation')
    expect(nav).toHaveTextContent(admin.name)
    expect(within(nav).getByRole('link', { name: 'Users' })).toBeInTheDocument()
  })

  it('hides the Users link from an agent', () => {
    renderNavBarAs(agent)

    const nav = screen.getByRole('navigation')
    expect(nav).toHaveTextContent(agent.name)
    expect(
      within(nav).queryByRole('link', { name: 'Users' }),
    ).not.toBeInTheDocument()
  })

  it('shows the Tickets link to any authenticated user', () => {
    renderNavBarAs(agent)

    const nav = screen.getByRole('navigation')
    expect(within(nav).getByRole('link', { name: 'Tickets' })).toBeInTheDocument()
  })
})
