import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axios from 'axios'
import { renderWithQueryClient } from '@/test/render'
import { useSession } from '@/lib/auth-client'
import { TicketAssignee } from './TicketAssignee'

// The picker fetches agents and saves via axios; mock the module so no real
// request is made. Role gates whether the control is editable, so mock the
// session too.
vi.mock('axios', () => ({
  default: { get: vi.fn(), patch: vi.fn(), isAxiosError: vi.fn() },
}))
vi.mock('@/lib/auth-client', () => ({ useSession: vi.fn() }))

const mockedGet = vi.mocked(axios.get)
const mockedPatch = vi.mocked(axios.patch)
const mockedIsAxiosError = vi.mocked(axios.isAxiosError)
const mockedUseSession = vi.mocked(useSession)

// Cast because the component only reads `user.role`, not the full session shape.
const setRole = (role: 'admin' | 'agent') =>
  mockedUseSession.mockReturnValue({ data: { user: { role } } } as never)

const agents = [
  { id: 'u1', name: 'Alex Agent', email: 'alex@acme.com' },
  { id: 'u2', name: 'Sam Support', email: 'sam@acme.com' },
]

type Assignee = { id: string; name: string; email: string } | null

const renderAssignee = (assignee: Assignee = agents[0]) =>
  renderWithQueryClient(<TicketAssignee ticketId="t1" assignee={assignee} />)

beforeEach(() => {
  mockedGet.mockReset()
  mockedPatch.mockReset()
  mockedIsAxiosError.mockReset()
  mockedUseSession.mockReset()
})

describe('TicketAssignee', () => {
  it('shows an editable picker with the current assignee for an admin', async () => {
    setRole('admin')
    mockedGet.mockResolvedValue({ data: agents })
    renderAssignee()

    expect(
      await screen.findByRole('combobox', { name: /assign to/i }),
    ).toHaveTextContent('Alex Agent')
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/api/agents'))
  })

  it('shows "Unassigned" in the picker when there is no assignee', async () => {
    setRole('admin')
    mockedGet.mockResolvedValue({ data: agents })
    renderAssignee(null)

    expect(
      await screen.findByRole('combobox', { name: /assign to/i }),
    ).toHaveTextContent('Unassigned')
  })

  it('assigns the chosen agent', async () => {
    const user = userEvent.setup()
    setRole('admin')
    mockedGet.mockResolvedValue({ data: agents })
    mockedPatch.mockResolvedValue({ data: {} })
    renderAssignee()

    await user.click(await screen.findByRole('combobox', { name: /assign to/i }))
    await user.click(await screen.findByRole('option', { name: 'Sam Support' }))

    await waitFor(() =>
      expect(mockedPatch).toHaveBeenCalledWith('/api/tickets/t1', {
        assigneeId: 'u2',
      }),
    )
  })

  it('unassigns when "Unassigned" is chosen', async () => {
    const user = userEvent.setup()
    setRole('admin')
    mockedGet.mockResolvedValue({ data: agents })
    mockedPatch.mockResolvedValue({ data: {} })
    renderAssignee()

    await user.click(await screen.findByRole('combobox', { name: /assign to/i }))
    await user.click(await screen.findByRole('option', { name: 'Unassigned' }))

    await waitFor(() =>
      expect(mockedPatch).toHaveBeenCalledWith('/api/tickets/t1', {
        assigneeId: null,
      }),
    )
  })

  it('shows an error when assignment fails', async () => {
    const user = userEvent.setup()
    setRole('admin')
    mockedGet.mockResolvedValue({ data: agents })
    mockedIsAxiosError.mockReturnValue(true)
    mockedPatch.mockRejectedValue({
      response: { data: { error: 'Assignee must be an active agent' } },
    })
    renderAssignee()

    await user.click(await screen.findByRole('combobox', { name: /assign to/i }))
    await user.click(await screen.findByRole('option', { name: 'Sam Support' }))

    expect(
      await screen.findByText('Assignee must be an active agent'),
    ).toBeInTheDocument()
  })

  it('renders read-only for a non-admin, without fetching agents', () => {
    setRole('agent')
    renderAssignee()

    expect(screen.getByText('Alex Agent')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(mockedGet).not.toHaveBeenCalled()
  })

  it('renders "Unassigned" read-only for a non-admin when unassigned', () => {
    setRole('agent')
    renderAssignee(null)

    expect(screen.getByText('Unassigned')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})
