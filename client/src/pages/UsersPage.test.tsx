import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axios from 'axios'
import { renderWithQueryClient } from '@/test/render'
import UsersPage from './UsersPage'

// UsersPage fetches through axios; mock the module so no real request is made.
vi.mock('axios', () => ({
  default: { get: vi.fn() },
}))

const mockedGet = vi.mocked(axios.get)

// Mirror the component's formatter so the expectation is locale/timezone-agnostic.
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

const users = [
  {
    id: '1',
    name: 'Ada Admin',
    email: 'ada@example.com',
    role: 'admin',
    createdAt: '2026-01-15T10:00:00.000Z',
  },
  {
    id: '2',
    name: 'Aggie Agent',
    email: 'aggie@example.com',
    role: 'agent',
    createdAt: '2026-02-20T10:00:00.000Z',
  },
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

    // Created date is shown, human-formatted, in the user's row.
    expect(
      within(adminRow).getByText(
        dateFormatter.format(new Date('2026-01-15T10:00:00.000Z')),
      ),
    ).toBeInTheDocument()

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

  describe('the New user dialog', () => {
    // Opens the dialog via the trigger button and returns the dialog element.
    const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(screen.getByRole('button', { name: /new user/i }))
      return screen.findByRole('dialog')
    }

    it('opens when the New user button is clicked', async () => {
      mockedGet.mockResolvedValue({ data: users })
      const user = userEvent.setup()

      renderPage()

      // Nothing is rendered until the trigger is clicked.
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      const dialog = await openDialog(user)
      expect(dialog).toBeInTheDocument()
      // The description is unique to the dialog (the "New user" text is shared
      // with the trigger button), so assert on it to confirm the content shows.
      expect(
        within(dialog).getByText('Create a new agent account for the helpdesk.'),
      ).toBeInTheDocument()
    })

    it('closes when the Escape key is pressed', async () => {
      mockedGet.mockResolvedValue({ data: users })
      const user = userEvent.setup()

      renderPage()

      await openDialog(user)
      await user.keyboard('{Escape}')

      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      )
    })

    it('closes when clicking outside the dialog (the backdrop)', async () => {
      mockedGet.mockResolvedValue({ data: users })
      const user = userEvent.setup()

      renderPage()

      await openDialog(user)

      const backdrop = document.querySelector('[data-slot="dialog-overlay"]')
      expect(backdrop).not.toBeNull()
      await user.click(backdrop!)

      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      )
    })

    it('closes when the close button is clicked', async () => {
      mockedGet.mockResolvedValue({ data: users })
      const user = userEvent.setup()

      renderPage()

      const dialog = await openDialog(user)
      await user.click(within(dialog).getByRole('button', { name: /close/i }))

      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      )
    })
  })
})
