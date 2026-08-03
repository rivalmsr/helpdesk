import { screen, waitFor, within } from '@testing-library/react'
import axios from 'axios'
import { renderWithQueryClient } from '@/test/render'
import DashboardPage from './DashboardPage'

// DashboardPage fetches through axios; mock the module so no real request is made.
vi.mock('axios', () => ({
  default: { get: vi.fn() },
}))

const mockedGet = vi.mocked(axios.get)

const stats = {
  total: 40,
  open: 7,
  aiResolved: 10,
  avgResolutionSeconds: 8100, // 2h 15m
  dailyVolume: [
    { day: '2026-08-01', count: 3 },
    { day: '2026-08-02', count: 0 },
    { day: '2026-08-03', count: 5 },
  ],
}

// Stubs the stats request with the given payload, then renders the page.
const renderWithStats = (data: Partial<typeof stats> = {}) => {
  mockedGet.mockResolvedValue({ data: { ...stats, ...data } })
  return renderWithQueryClient(<DashboardPage />)
}

// Finds the value rendered under a given tile label (label and value share a
// tile), so a metric assertion isn't fooled by the same number appearing twice.
const tileValue = async (label: string) => {
  const labelEl = await screen.findByText(label)
  const tile = labelEl.closest('[data-slot="card"]')
  if (!tile) throw new Error(`No tile found for "${label}"`)
  return within(tile as HTMLElement)
}

beforeEach(() => {
  mockedGet.mockReset()
})

describe('DashboardPage', () => {
  it('requests the stats endpoint', async () => {
    renderWithStats()

    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/api/stats'))
  })

  it('shows skeleton placeholders while loading', () => {
    // A promise that never resolves keeps the query in its pending state.
    mockedGet.mockReturnValue(new Promise(() => {}))

    const { container } = renderWithQueryClient(<DashboardPage />)

    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length,
    ).toBeGreaterThan(0)
    // The heading renders during loading, but no values yet.
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
  })

  it('renders the total and open ticket counts', async () => {
    renderWithStats()

    expect((await tileValue('Total tickets')).getByText('40')).toBeInTheDocument()
    expect((await tileValue('Open tickets')).getByText('7')).toBeInTheDocument()
  })

  it('renders the AI-resolved count and computed percentage', async () => {
    renderWithStats()

    // 10 of 40 tickets -> 25%.
    expect((await tileValue('Resolved by AI')).getByText('10')).toBeInTheDocument()
    expect(
      (await tileValue('AI resolution rate')).getByText('25%'),
    ).toBeInTheDocument()
  })

  it('shows 0% AI resolution when there are no tickets', async () => {
    renderWithStats({ total: 0, open: 0, aiResolved: 0, avgResolutionSeconds: null })

    expect(
      (await tileValue('AI resolution rate')).getByText('0%'),
    ).toBeInTheDocument()
  })

  it('formats the average resolution time and describes the formula', async () => {
    renderWithStats()

    const tile = await tileValue('Avg. resolution time')
    expect(tile.getByText('2h 15m')).toBeInTheDocument()
    expect(tile.getByText('Avg. of last update − created')).toBeInTheDocument()
  })

  it('renders an em dash when there is no resolution time to average', async () => {
    renderWithStats({ avgResolutionSeconds: null })

    expect(
      (await tileValue('Avg. resolution time')).getByText('—'),
    ).toBeInTheDocument()
  })

  it('renders the tickets-per-day chart once loaded', async () => {
    renderWithStats()

    expect(await screen.findByText('Tickets per day')).toBeInTheDocument()
    // The chart is an SVG (role/title aren't reliably exposed via a11y queries
    // under happy-dom, so assert on the node directly). Wait for it, since the
    // card header renders before the stats query resolves the chart.
    await waitFor(() =>
      expect(
        document.querySelector('svg[aria-label*="tickets created per day"]'),
      ).not.toBeNull(),
    )
  })

  it('shows an error message when the request fails', async () => {
    mockedGet.mockRejectedValue(new Error('boom'))

    renderWithQueryClient(<DashboardPage />)

    expect(await screen.findByText('Failed to load dashboard')).toBeInTheDocument()
    expect(screen.queryByText('Total tickets')).not.toBeInTheDocument()
  })
})
