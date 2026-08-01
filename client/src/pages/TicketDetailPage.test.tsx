import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import axios from 'axios'
import { renderWithProviders } from '@/test/render'
import { useSession } from '@/lib/auth-client'
import { formatDateTime } from '@/lib/format'
import TicketDetailPage from './TicketDetailPage'

// TicketDetailPage fetches through axios; mock the module so no real request is
// made. `isAxiosError` is stubbed so the 404 / error branches can be exercised.
vi.mock('axios', () => ({
  default: { get: vi.fn(), patch: vi.fn(), isAxiosError: vi.fn() },
}))

// The page reads the session role to decide whether the assignee is editable.
vi.mock('@/lib/auth-client', () => ({ useSession: vi.fn() }))

const mockedGet = vi.mocked(axios.get)
const mockedPatch = vi.mocked(axios.patch)
const mockedIsAxiosError = vi.mocked(axios.isAxiosError)
const mockedUseSession = vi.mocked(useSession)

// Sets the signed-in user's role (admin sees the assignee select; agent sees it
// read-only). Cast because the test only needs `user.role`, not the full shape.
const setRole = (role: 'admin' | 'agent') =>
  mockedUseSession.mockReturnValue({ data: { user: { role } } } as never)

const agents = [
  { id: 'u1', name: 'Alex Agent', email: 'alex@acme.com' },
  { id: 'u2', name: 'Sam Support', email: 'sam@acme.com' },
]

// Serves the ticket for `/api/tickets/:id` and the agent list for `/api/agents`
// (the admin-only picker fetches the latter).
const mockGet = (data = ticket) =>
  mockedGet.mockImplementation((url: string) =>
    url === '/api/agents'
      ? Promise.resolve({ data: agents })
      : Promise.resolve({ data }),
  )

const ticket = {
  id: '1',
  subject: 'Cannot access dashboard',
  requesterEmail: 'jane@acme.com',
  status: 'open',
  category: 'technical',
  assignee: { id: 'u1', name: 'Alex Agent', email: 'alex@acme.com' },
  createdAt: '2026-03-10T10:00:00.000Z',
  updatedAt: '2026-03-10T12:00:00.000Z',
  messages: [
    {
      id: 'm1',
      type: 'inbound',
      fromEmail: 'jane@acme.com',
      body: 'I keep getting logged out.',
      createdAt: '2026-03-10T10:00:00.000Z',
    },
    {
      id: 'm2',
      type: 'inbound',
      fromEmail: 'jane@acme.com',
      body: 'Still broken, please help.',
      createdAt: '2026-03-10T11:00:00.000Z',
    },
  ],
}

// Renders the page at `/tickets/:id` so `useParams` sees the id.
const renderDetail = (id = '1') =>
  renderWithProviders(
    <Routes>
      <Route path="/tickets/:id" element={<TicketDetailPage />} />
    </Routes>,
    { initialEntries: [`/tickets/${id}`] },
  )

// Builds an Axios-style 404 error and points the mocks at it. `isAxiosError`
// mirrors real axios (false for a null/non-axios value) so the initial render,
// where the query error is still null, doesn't trip the not-found check.
const reject404 = () => {
  mockedIsAxiosError.mockImplementation((e) => Boolean(e && (e as any).response))
  mockedGet.mockRejectedValue({ response: { status: 404 } })
}

beforeEach(() => {
  mockedGet.mockReset()
  mockedPatch.mockReset()
  mockedIsAxiosError.mockReset()
  mockedUseSession.mockReset()
  // Default to an agent (read-only assignee); admin tests opt in via setRole.
  setRole('agent')
})

describe('TicketDetailPage', () => {
  it('requests the ticket by id from the params', async () => {
    mockedGet.mockResolvedValue({ data: ticket })
    renderDetail('1')

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Cannot access dashboard',
    )
    expect(mockedGet).toHaveBeenCalledWith('/api/tickets/1')
  })

  it('renders the ticket header with requester, status and category', async () => {
    mockedGet.mockResolvedValue({ data: ticket })
    renderDetail()

    // The requester email also appears on each message; scope to the header's
    // "Requester" field via its label's containing <div>.
    const requesterField = (await screen.findByText('Requester')).parentElement!
    expect(requesterField).toHaveTextContent('jane@acme.com')
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.getByText('Technical Question')).toBeInTheDocument()
  })

  it('shows the assignee under an "Assigned To" label', async () => {
    mockedGet.mockResolvedValue({ data: ticket })
    renderDetail()

    expect(await screen.findByText('Assigned To')).toBeInTheDocument()
    expect(screen.getByText('Alex Agent')).toBeInTheDocument()
  })

  it('shows "Unassigned" when no agent is assigned', async () => {
    mockedGet.mockResolvedValue({ data: { ...ticket, assignee: null } })
    renderDetail()

    expect(await screen.findByText('Unassigned')).toBeInTheDocument()
  })

  it('shows the assignee read-only for an agent (no picker, no agents fetch)', async () => {
    setRole('agent')
    mockGet()
    renderDetail()

    expect(await screen.findByText('Alex Agent')).toBeInTheDocument()
    expect(
      screen.queryByRole('combobox', { name: /assign to/i }),
    ).not.toBeInTheDocument()
    expect(mockedGet).not.toHaveBeenCalledWith('/api/agents')
  })

  it('lets an admin assign an agent and reflects it once saved', async () => {
    const user = userEvent.setup()
    setRole('admin')
    mockGet()
    mockedPatch.mockResolvedValue({ data: { ...ticket, assignee: agents[1] } })
    renderDetail()

    await screen.findByRole('heading', { level: 1 })
    await user.click(screen.getByRole('combobox', { name: /assign to/i }))
    await user.click(await screen.findByRole('option', { name: 'Sam Support' }))

    await waitFor(() =>
      expect(mockedPatch).toHaveBeenCalledWith('/api/tickets/1', {
        assigneeId: 'u2',
      }),
    )
    // The controlled value only updates after the server round-trip succeeds.
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: /assign to/i }),
      ).toHaveTextContent('Sam Support'),
    )
  })

  it('lets an admin unassign, sending a null assignee', async () => {
    const user = userEvent.setup()
    setRole('admin')
    mockGet()
    mockedPatch.mockResolvedValue({ data: { ...ticket, assignee: null } })
    renderDetail()

    await screen.findByRole('heading', { level: 1 })
    await user.click(screen.getByRole('combobox', { name: /assign to/i }))
    await user.click(await screen.findByRole('option', { name: 'Unassigned' }))

    await waitFor(() =>
      expect(mockedPatch).toHaveBeenCalledWith('/api/tickets/1', {
        assigneeId: null,
      }),
    )
  })

  it('surfaces an error when assigning fails', async () => {
    const user = userEvent.setup()
    setRole('admin')
    mockGet()
    // Realistic isAxiosError (true only for values with a `response`) so the
    // detail query's null error doesn't trip the not-found path.
    mockedIsAxiosError.mockImplementation((e) => Boolean(e && (e as any).response))
    mockedPatch.mockRejectedValue({
      response: { data: { error: 'Assignee must be an active agent' } },
    })
    renderDetail()

    await screen.findByRole('heading', { level: 1 })
    await user.click(screen.getByRole('combobox', { name: /assign to/i }))
    await user.click(await screen.findByRole('option', { name: 'Sam Support' }))

    expect(
      await screen.findByText('Assignee must be an active agent'),
    ).toBeInTheDocument()
  })

  it('renders each message in the thread with its timestamp', async () => {
    mockedGet.mockResolvedValue({ data: ticket })
    renderDetail()

    expect(
      await screen.findByText('I keep getting logged out.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Still broken, please help.')).toBeInTheDocument()
    expect(
      screen.getByText(formatDateTime('2026-03-10T11:00:00.000Z')),
    ).toBeInTheDocument()
  })

  it('has a back link to the ticket list', async () => {
    mockedGet.mockResolvedValue({ data: ticket })
    renderDetail()

    await screen.findByRole('heading', { level: 1 })
    expect(
      screen.getByRole('link', { name: /back to tickets/i }),
    ).toHaveAttribute('href', '/tickets')
  })

  it('shows a not-found message for a missing ticket', async () => {
    reject404()
    renderDetail('missing')

    expect(await screen.findByText('Ticket not found.')).toBeInTheDocument()
  })

  it('shows a generic error message when the request fails', async () => {
    mockedIsAxiosError.mockReturnValue(false)
    mockedGet.mockRejectedValue(new Error('boom'))
    renderDetail()

    expect(await screen.findByText('Failed to load ticket')).toBeInTheDocument()
  })
})
