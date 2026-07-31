import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

// Wraps a ticket array in the paginated envelope the API now returns.
// `total` defaults to the array length (single page); pass a larger value to
// simulate multiple pages.
const paginated = (data: typeof tickets, total = data.length) => ({
  tickets: data,
  total,
  page: 1,
  pageSize: 10,
})

// Stubs the tickets request with the given payload, then renders the page.
const renderWithTickets = (data: typeof tickets = tickets, total?: number) => {
  mockedGet.mockResolvedValue({ data: paginated(data, total) })
  return renderWithQueryClient(<TicketsPage />)
}

// Finds a table row by the text it contains (rows expose their cell text as
// their accessible name), so assertions can be scoped to a single ticket.
const findRow = (name: RegExp) => screen.findByRole('row', { name })

beforeEach(() => {
  mockedGet.mockReset()
})

describe('TicketsPage', () => {
  it('requests the tickets endpoint sorted newest-first by default', async () => {
    renderWithTickets()

    await waitFor(() =>
      expect(mockedGet).toHaveBeenCalledWith('/api/tickets', {
        params: { sort: 'createdAt', order: 'desc' },
      }),
    )
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

  it('re-requests sorted ascending, then descending, when a column header is clicked', async () => {
    const user = userEvent.setup()
    renderWithTickets()
    await findRow(/Cannot access dashboard/)

    // First click on an unsorted column sorts it ascending...
    await user.click(screen.getByRole('button', { name: /subject/i }))
    await waitFor(() =>
      expect(mockedGet).toHaveBeenLastCalledWith('/api/tickets', {
        params: { sort: 'subject', order: 'asc' },
      }),
    )

    // ...and clicking again flips to descending.
    await user.click(screen.getByRole('button', { name: /subject/i }))
    await waitFor(() =>
      expect(mockedGet).toHaveBeenLastCalledWith('/api/tickets', {
        params: { sort: 'subject', order: 'desc' },
      }),
    )
  })

  it('exposes the active sort direction via aria-sort on the header', async () => {
    const user = userEvent.setup()
    renderWithTickets()
    await findRow(/Cannot access dashboard/)

    // Created is the default sort (newest-first → descending).
    expect(screen.getByRole('columnheader', { name: /created/i })).toHaveAttribute(
      'aria-sort',
      'descending',
    )

    await user.click(screen.getByRole('button', { name: /subject/i }))

    await waitFor(() =>
      expect(
        screen.getByRole('columnheader', { name: /subject/i }),
      ).toHaveAttribute('aria-sort', 'ascending'),
    )
    // The previous sort column is no longer marked.
    expect(screen.getByRole('columnheader', { name: /created/i })).toHaveAttribute(
      'aria-sort',
      'none',
    )
  })

  it('filters by status, adding the status query param', async () => {
    const user = userEvent.setup()
    renderWithTickets()
    await findRow(/Cannot access dashboard/)

    // Open the status dropdown and pick "Open" (the table's status Badge, not
    // an option, shares the text — role: 'option' scopes to the listbox).
    await user.click(screen.getByRole('combobox', { name: /filter by status/i }))
    await user.click(await screen.findByRole('option', { name: 'Open' }))

    await waitFor(() =>
      expect(mockedGet).toHaveBeenLastCalledWith('/api/tickets', {
        params: { sort: 'createdAt', order: 'desc', status: 'open' },
      }),
    )
  })

  it('filters by category, adding the category query param', async () => {
    const user = userEvent.setup()
    renderWithTickets()
    await findRow(/Cannot access dashboard/)

    await user.click(screen.getByRole('combobox', { name: /filter by category/i }))
    await user.click(await screen.findByRole('option', { name: 'Technical' }))

    await waitFor(() =>
      expect(mockedGet).toHaveBeenLastCalledWith('/api/tickets', {
        params: { sort: 'createdAt', order: 'desc', category: 'technical' },
      }),
    )
  })

  it('searches (debounced) via the q query param', async () => {
    const user = userEvent.setup()
    renderWithTickets()
    await findRow(/Cannot access dashboard/)

    await user.type(
      screen.getByRole('searchbox', { name: /search tickets/i }),
      'refund',
    )

    // Fires once the input settles (debounced), with the trimmed search term.
    await waitFor(() =>
      expect(mockedGet).toHaveBeenLastCalledWith('/api/tickets', {
        params: { sort: 'createdAt', order: 'desc', q: 'refund' },
      }),
    )
  })

  it('shows a filtered-empty message and clears filters', async () => {
    const user = userEvent.setup()
    // Initial load has rows; the filtered request comes back empty.
    mockedGet.mockResolvedValueOnce({ data: paginated(tickets) })
    mockedGet.mockResolvedValue({ data: paginated([], 0) })
    renderWithQueryClient(<TicketsPage />)
    await findRow(/Cannot access dashboard/)

    await user.click(screen.getByRole('combobox', { name: /filter by status/i }))
    await user.click(await screen.findByRole('option', { name: 'Closed' }))

    expect(
      await screen.findByText('No tickets match your filters.'),
    ).toBeInTheDocument()

    // Clearing returns the request to the default sort-only shape.
    await user.click(screen.getByRole('button', { name: /clear/i }))
    await waitFor(() =>
      expect(mockedGet).toHaveBeenLastCalledWith('/api/tickets', {
        params: { sort: 'createdAt', order: 'desc' },
      }),
    )
  })

  it('shows page info and disables Previous on the first page', async () => {
    // total 25 with the default pageSize 10 → 3 pages.
    renderWithTickets(tickets, 25)
    await findRow(/Cannot access dashboard/)

    expect(screen.getByText('Page 1 of 3 · 25 total')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled()
  })

  it('requests the next page and returns to the first, updating page params', async () => {
    const user = userEvent.setup()
    // total 15 with pageSize 10 → 2 pages.
    renderWithTickets(tickets, 15)
    await findRow(/Cannot access dashboard/)

    // Next → page 2 appears in the request.
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() =>
      expect(mockedGet).toHaveBeenLastCalledWith('/api/tickets', {
        params: { sort: 'createdAt', order: 'desc', page: 2 },
      }),
    )
    expect(screen.getByText('Page 2 of 2 · 15 total')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()

    // Previous → back to page 1, which omits the page param.
    await user.click(screen.getByRole('button', { name: /previous/i }))
    await waitFor(() =>
      expect(mockedGet).toHaveBeenLastCalledWith('/api/tickets', {
        params: { sort: 'createdAt', order: 'desc' },
      }),
    )
  })

  it('jumps to the last page and back to the first', async () => {
    const user = userEvent.setup()
    // total 25 with pageSize 10 → 3 pages.
    renderWithTickets(tickets, 25)
    await findRow(/Cannot access dashboard/)

    // Last page → page 3 (the final page).
    await user.click(screen.getByRole('button', { name: /last page/i }))
    await waitFor(() =>
      expect(mockedGet).toHaveBeenLastCalledWith('/api/tickets', {
        params: { sort: 'createdAt', order: 'desc', page: 3 },
      }),
    )
    expect(screen.getByText('Page 3 of 3 · 25 total')).toBeInTheDocument()

    // First page → back to page 1, which omits the page param.
    await user.click(screen.getByRole('button', { name: /first page/i }))
    await waitFor(() =>
      expect(mockedGet).toHaveBeenLastCalledWith('/api/tickets', {
        params: { sort: 'createdAt', order: 'desc' },
      }),
    )
  })

  it('changes the page size (and resets to the first page)', async () => {
    const user = userEvent.setup()
    renderWithTickets(tickets, 25)
    await findRow(/Cannot access dashboard/)

    // Move off page 1 first, to prove the page-size change resets it.
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() =>
      expect(mockedGet).toHaveBeenLastCalledWith('/api/tickets', {
        params: { sort: 'createdAt', order: 'desc', page: 2 },
      }),
    )

    // Pick 50 rows per page → sends pageSize, and page is back to 1 (omitted).
    await user.click(screen.getByRole('combobox', { name: /rows per page/i }))
    await user.click(await screen.findByRole('option', { name: '50' }))
    await waitFor(() =>
      expect(mockedGet).toHaveBeenLastCalledWith('/api/tickets', {
        params: { sort: 'createdAt', order: 'desc', pageSize: 50 },
      }),
    )
  })

  it('resets to the first page when a filter changes', async () => {
    const user = userEvent.setup()
    renderWithTickets(tickets, 25)
    await findRow(/Cannot access dashboard/)

    // Go to page 2, then apply a status filter.
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() =>
      expect(mockedGet).toHaveBeenLastCalledWith('/api/tickets', {
        params: { sort: 'createdAt', order: 'desc', page: 2 },
      }),
    )

    await user.click(screen.getByRole('combobox', { name: /filter by status/i }))
    await user.click(await screen.findByRole('option', { name: 'Open' }))

    // The filtered request starts at page 1 again (no page param).
    await waitFor(() =>
      expect(mockedGet).toHaveBeenLastCalledWith('/api/tickets', {
        params: { sort: 'createdAt', order: 'desc', status: 'open' },
      }),
    )
  })
})
