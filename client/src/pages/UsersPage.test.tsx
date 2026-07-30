import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axios from 'axios'
import { renderWithQueryClient } from '@/test/render'
import { formatDate } from '@/lib/format'
import UsersPage from './UsersPage'

// UsersPage fetches through axios; mock the module so no real request is made.
vi.mock('axios', () => ({
  default: { get: vi.fn() },
}))

const mockedGet = vi.mocked(axios.get)

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

// Stubs the users request with the given payload, then renders the page.
const renderWithUsers = (data: typeof users = users) => {
  mockedGet.mockResolvedValue({ data })
  return renderWithQueryClient(<UsersPage />)
}

// Finds a table row by the text it contains (rows expose their cell text as
// their accessible name), so assertions can be scoped to a single user.
const findRow = (name: RegExp) => screen.findByRole('row', { name })

beforeEach(() => {
  mockedGet.mockReset()
})

describe('UsersPage', () => {
  it('requests the users endpoint', async () => {
    renderWithUsers()

    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/api/users'))
  })

  it('shows skeleton placeholders while loading', () => {
    // A promise that never resolves keeps the query in its pending state.
    mockedGet.mockReturnValue(new Promise(() => {}))

    const { container } = renderWithQueryClient(<UsersPage />)

    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length,
    ).toBeGreaterThan(0)
    // The header renders during loading, but no real rows and no "Loading…" text.
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
  })

  it('renders a row for each user once loaded', async () => {
    renderWithUsers()

    expect(within(await findRow(/Ada Admin/)).getByText('ada@example.com')).toBeInTheDocument()
    expect(within(await findRow(/Aggie Agent/)).getByText('aggie@example.com')).toBeInTheDocument()
  })

  it('shows the role of each user as a badge', async () => {
    renderWithUsers()

    expect(within(await findRow(/Ada Admin/)).getByText('admin')).toBeInTheDocument()
    expect(within(await findRow(/Aggie Agent/)).getByText('agent')).toBeInTheDocument()
  })

  it('formats the created date as a human-friendly date', async () => {
    renderWithUsers()

    const created = formatDate('2026-01-15T10:00:00.000Z')
    expect(within(await findRow(/Ada Admin/)).getByText(created)).toBeInTheDocument()
  })

  it('removes the loading skeletons once data has loaded', async () => {
    renderWithUsers()

    await findRow(/Ada Admin/)
    expect(document.querySelector('[data-slot="skeleton"]')).toBeNull()
  })

  it('shows an edit action for each user', async () => {
    renderWithUsers()

    expect(
      await screen.findByRole('button', { name: /edit Ada Admin/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /edit Aggie Agent/i }),
    ).toBeInTheDocument()
  })

  it('shows an empty state when there are no users', async () => {
    renderWithUsers([])

    expect(await screen.findByText('No users found.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows an error message when the request fails', async () => {
    mockedGet.mockRejectedValue(new Error('boom'))

    renderWithQueryClient(<UsersPage />)

    expect(await screen.findByText('Failed to load users')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  describe('the New user dialog', () => {
    // Opens the dialog via the trigger button and returns the dialog element.
    // Awaiting the dialog here means the close tests fail loudly if it never
    // opened, rather than passing on a dialog that was never there.
    const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(screen.getByRole('button', { name: /new user/i }))
      return screen.findByRole('dialog')
    }

    const expectDialogClosed = () =>
      waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      )

    it('opens when the New user button is clicked', async () => {
      const user = userEvent.setup()
      renderWithUsers()

      // Nothing is rendered until the trigger is clicked.
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      const dialog = await openDialog(user)
      // The description is unique to the dialog (the "New user" text is shared
      // with the trigger button), so assert on it to confirm the content shows.
      expect(
        within(dialog).getByText('Create a new agent account for the helpdesk.'),
      ).toBeInTheDocument()
    })

    it('closes when the Escape key is pressed', async () => {
      const user = userEvent.setup()
      renderWithUsers()

      await openDialog(user)
      await user.keyboard('{Escape}')

      await expectDialogClosed()
    })

    it('closes when clicking outside the dialog (the backdrop)', async () => {
      const user = userEvent.setup()
      renderWithUsers()

      await openDialog(user)
      // The backdrop has no accessible role, so target it by its slot.
      const backdrop = document.querySelector('[data-slot="dialog-overlay"]')
      expect(backdrop).not.toBeNull()
      await user.click(backdrop!)

      await expectDialogClosed()
    })

    it('closes when the close button is clicked', async () => {
      const user = userEvent.setup()
      renderWithUsers()

      const dialog = await openDialog(user)
      await user.click(within(dialog).getByRole('button', { name: /close/i }))

      await expectDialogClosed()
    })
  })
})
