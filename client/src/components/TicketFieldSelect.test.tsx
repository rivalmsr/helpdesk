import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axios from 'axios'
import { renderWithQueryClient } from '@/test/render'
import { TicketFieldSelect } from './TicketFieldSelect'

// The control saves via axios.patch; mock the module so no real request is made.
// `isAxiosError` is stubbed so the error branch can be exercised.
vi.mock('axios', () => ({
  default: { patch: vi.fn(), isAxiosError: vi.fn() },
}))

const mockedPatch = vi.mocked(axios.patch)
const mockedIsAxiosError = vi.mocked(axios.isAxiosError)

const statusOptions = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

const renderStatus = (value = 'open') =>
  renderWithQueryClient(
    <TicketFieldSelect
      ticketId="t1"
      field="status"
      value={value}
      options={statusOptions}
      ariaLabel="Change status"
    />,
  )

beforeEach(() => {
  mockedPatch.mockReset()
  mockedIsAxiosError.mockReset()
})

describe('TicketFieldSelect', () => {
  it('shows the current value and lists the options', async () => {
    const user = userEvent.setup()
    renderStatus('open')

    const trigger = screen.getByRole('combobox', { name: /change status/i })
    expect(trigger).toHaveTextContent('Open')

    await user.click(trigger)
    expect(
      await screen.findByRole('option', { name: 'Resolved' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Closed' })).toBeInTheDocument()
  })

  it('patches the ticket with the chosen value', async () => {
    const user = userEvent.setup()
    mockedPatch.mockResolvedValue({ data: {} })
    renderStatus('open')

    await user.click(screen.getByRole('combobox', { name: /change status/i }))
    await user.click(await screen.findByRole('option', { name: 'Resolved' }))

    await waitFor(() =>
      expect(mockedPatch).toHaveBeenCalledWith('/api/tickets/t1', {
        status: 'resolved',
      }),
    )
  })

  it('keys the update by the `field` prop', async () => {
    const user = userEvent.setup()
    mockedPatch.mockResolvedValue({ data: {} })
    renderWithQueryClient(
      <TicketFieldSelect
        ticketId="t1"
        field="category"
        value="general"
        options={[
          { value: 'general', label: 'General' },
          { value: 'refund', label: 'Refund Request' },
        ]}
        ariaLabel="Change category"
      />,
    )

    await user.click(screen.getByRole('combobox', { name: /change category/i }))
    await user.click(await screen.findByRole('option', { name: 'Refund Request' }))

    await waitFor(() =>
      expect(mockedPatch).toHaveBeenCalledWith('/api/tickets/t1', {
        category: 'refund',
      }),
    )
  })

  it('shows an error message when the update fails', async () => {
    const user = userEvent.setup()
    mockedIsAxiosError.mockReturnValue(true)
    mockedPatch.mockRejectedValue({ response: { data: { error: 'Nope' } } })
    renderStatus('open')

    await user.click(screen.getByRole('combobox', { name: /change status/i }))
    await user.click(await screen.findByRole('option', { name: 'Resolved' }))

    expect(await screen.findByText('Nope')).toBeInTheDocument()
  })
})
