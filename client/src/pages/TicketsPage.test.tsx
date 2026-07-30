import { screen, waitFor, within } from '@testing-library/react'
import axios from 'axios'
import { renderWithQueryClient } from '@/test/render'
import { formatDate } from '@/lib/format'
import TicketsPage from './TicketsPage'

// TicketsPage fetches through axios; mock the module so no real request is made.
vi.mock('axios', () => ({
  default: { get: vi.fn() },
}))

const mockedGet = vi.mocked(axios.get)

// Ordered newest-first, as the API (`order by createdAt desc`) returns them.
const tickets = [
  {
    id: '1',
    subject: 'Cannot access dashboard',
    requesterEmail: 'jane@acme.com',
    status: 'open',
    category: 'technical',
    createdAt: '2026-03-10T10:00:00.000Z',
    updatedAt: '2026-03-10T10:00:00.000Z',
    _count: { messages: 2 },
  },
  {
    id: '2',
    subject: 'Refund please',
    requesterEmail: 'bob@acme.com',
    status: 'resolved',
    category: 'refund',
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-02-05T10:00:00.000Z',
    _count: { messages: 1 },
  },
]

// Stubs the tickets request with the given payload, then renders the page.
const renderWithTickets = (data: typeof tickets = tickets) => {
  mockedGet.mockResolvedValue({ data })
  return renderWithQueryClient(<TicketsPage />)
}

// Finds a table row by the text it contains (rows expose their cell text as
// their accessible name), so assertions can be scoped to a single ticket.
const findRow = (name: RegExp) => screen.findByRole('row', { name })

beforeEach(() => {
  mockedGet.mockReset()
})

describe('TicketsPage', () => {
  it('requests the tickets endpoint', async () => {
    renderWithTickets()

    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/api/tickets'))
  })

  it('shows skeleton placeholders while loading', () => {
    // A promise that never resolves keeps the query in its pending state.
    mockedGet.mockReturnValue(new Promise(() => {}))

    const { container } = renderWithQueryClient(<TicketsPage />)

    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length,
    ).toBeGreaterThan(0)
    // The header renders during loading, but no real rows and no "Loading…" text.
    expect(screen.getByText('Subject')).toBeInTheDocument()
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
  })

  it('renders a row for each ticket once loaded', async () => {
    renderWithTickets()

    expect(
      within(await findRow(/Cannot access dashboard/)).getByText('jane@acme.com'),
    ).toBeInTheDocument()
    expect(
      within(await findRow(/Refund please/)).getByText('bob@acme.com'),
    ).toBeInTheDocument()
  })

  it('shows the status as a human-friendly badge', async () => {
    renderWithTickets()

    expect(within(await findRow(/Cannot access dashboard/)).getByText('Open')).toBeInTheDocument()
    expect(within(await findRow(/Refund please/)).getByText('Resolved')).toBeInTheDocument()
  })

  it('shows the category with its friendly label', async () => {
    renderWithTickets()

    expect(
      within(await findRow(/Cannot access dashboard/)).getByText('Technical Question'),
    ).toBeInTheDocument()
    expect(
      within(await findRow(/Refund please/)).getByText('Refund Request'),
    ).toBeInTheDocument()
  })

  it('shows the message count for each ticket', async () => {
    renderWithTickets()

    expect(within(await findRow(/Cannot access dashboard/)).getByText('2')).toBeInTheDocument()
    expect(within(await findRow(/Refund please/)).getByText('1')).toBeInTheDocument()
  })

  it('formats the created date as a human-friendly date', async () => {
    renderWithTickets()

    const created = formatDate('2026-03-10T10:00:00.000Z')
    expect(
      within(await findRow(/Cannot access dashboard/)).getByText(created),
    ).toBeInTheDocument()
  })

  it('renders tickets newest-first, in the order returned by the API', async () => {
    renderWithTickets()

    await findRow(/Cannot access dashboard/)
    // rows[0] is the header; body rows follow in DOM order.
    const [, first, second] = screen.getAllByRole('row')
    expect(first).toHaveTextContent('Cannot access dashboard')
    expect(second).toHaveTextContent('Refund please')
  })

  it('shows an empty state when there are no tickets', async () => {
    renderWithTickets([])

    expect(await screen.findByText('No tickets yet.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows an error message when the request fails', async () => {
    mockedGet.mockRejectedValue(new Error('boom'))

    renderWithQueryClient(<TicketsPage />)

    expect(await screen.findByText('Failed to load tickets')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
