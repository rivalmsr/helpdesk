import { screen, waitFor, within } from '@testing-library/react'
import axios from 'axios'
import { renderWithQueryClient } from '@/test/render'
import UsersPage from './UsersPage'

// UsersPage fetches through axios; mock the module so no real request is made.
vi.mock('axios', () => ({
  default: { get: vi.fn() },
}))

const mockedGet = vi.mocked(axios.get)

const users = [
  { id: '1', name: 'Ada Admin', email: 'ada@example.com', role: 'admin' },
  { id: '2', name: 'Aggie Agent', email: 'aggie@example.com', role: 'agent' },
]

const renderPage = () => renderWithQueryClient(<UsersPage />)

beforeEach(() => {
  mockedGet.mockReset()
})

describe('UsersPage', () => {
  it('requests the users endpoint', async () => {
    mockedGet.mockResolvedValue({ data: users })

    renderPage()

    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/api/users'))
  })

  it('shows skeleton placeholders while loading', () => {
    // A promise that never resolves keeps the query in its pending state.
    mockedGet.mockReturnValue(new Promise(() => {}))

    const { container } = renderPage()

    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length,
    ).toBeGreaterThan(0)
    // The header renders during loading, but no real rows and no "Loading…" text.
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
  })

  it('renders a row per user once loaded', async () => {
    mockedGet.mockResolvedValue({ data: users })

    renderPage()

    expect(await screen.findByText('Ada Admin')).toBeInTheDocument()
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
    expect(screen.getByText('Aggie Agent')).toBeInTheDocument()
    expect(screen.getByText('aggie@example.com')).toBeInTheDocument()

    // Role is shown as a badge in the user's row.
    const adminRow = screen.getByText('Ada Admin').closest('tr')!
    expect(within(adminRow).getByText('admin')).toBeInTheDocument()
    const agentRow = screen.getByText('Aggie Agent').closest('tr')!
    expect(within(agentRow).getByText('agent')).toBeInTheDocument()

    // Skeletons are gone once data has loaded.
    expect(document.querySelector('[data-slot="skeleton"]')).toBeNull()
  })

  it('shows an empty state when there are no users', async () => {
    mockedGet.mockResolvedValue({ data: [] })

    renderPage()

    expect(await screen.findByText('No users found.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows an error message when the request fails', async () => {
    mockedGet.mockRejectedValue(new Error('boom'))

    renderPage()

    expect(await screen.findByText('Failed to load users')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
