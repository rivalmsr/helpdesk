import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axios from 'axios'
import { renderWithQueryClient } from '@/test/render'
import { TicketReplyForm } from './TicketReplyForm'

// The form posts through axios; mock the module so no real request is made.
// `isAxiosError` is stubbed for the server-error branch (getServerErrorMessage).
vi.mock('axios', () => ({
  default: { post: vi.fn(), isAxiosError: vi.fn() },
}))

const mockedPost = vi.mocked(axios.post)
const mockedIsAxiosError = vi.mocked(axios.isAxiosError)

beforeEach(() => {
  mockedPost.mockReset()
  mockedIsAxiosError.mockReset()
})

describe('TicketReplyForm', () => {
  it('posts the reply to the ticket and clears the textarea on success', async () => {
    const user = userEvent.setup()
    mockedPost.mockResolvedValue({ data: {} })
    renderWithQueryClient(<TicketReplyForm ticketId="42" />)

    const textarea = screen.getByRole('textbox', { name: /reply/i })
    await user.type(textarea, 'On it now.')
    await user.click(screen.getByRole('button', { name: /send reply/i }))

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith('/api/tickets/42/messages', {
        body: 'On it now.',
      }),
    )
    // The composer resets so the agent can't accidentally resend the same reply.
    await waitFor(() => expect(textarea).toHaveValue(''))
  })

  it('rejects a blank reply without sending a request', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<TicketReplyForm ticketId="42" />)

    await user.type(screen.getByRole('textbox', { name: /reply/i }), '   ')
    await user.click(screen.getByRole('button', { name: /send reply/i }))

    expect(await screen.findByText('Reply body is required')).toBeInTheDocument()
    expect(mockedPost).not.toHaveBeenCalled()
  })

  it("surfaces the server's error message when the reply fails", async () => {
    const user = userEvent.setup()
    mockedIsAxiosError.mockReturnValue(true)
    mockedPost.mockRejectedValue({
      response: { data: { error: 'Ticket not found' } },
    })
    renderWithQueryClient(<TicketReplyForm ticketId="42" />)

    await user.type(screen.getByRole('textbox', { name: /reply/i }), 'Hello')
    await user.click(screen.getByRole('button', { name: /send reply/i }))

    expect(await screen.findByText('Ticket not found')).toBeInTheDocument()
  })
})
