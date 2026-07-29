import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axios from 'axios'
import { renderWithQueryClient } from '@/test/render'
import CreateUserDialog from './CreateUserDialog'

// CreateUserDialog submits through axios; mock the module so no real request
// is made. `isAxiosError` gates the server-error branch in the component.
vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    isAxiosError: vi.fn(),
  },
}))

const mockedPost = vi.mocked(axios.post)
const mockedIsAxiosError = vi.mocked(axios.isAxiosError)

beforeEach(() => {
  mockedPost.mockReset()
  mockedIsAxiosError.mockReset()
})

// Opens the dialog via the trigger button, fills the form, and returns the
// dialog element so callers can scope queries to it.
const openAndFill = async (
  user: ReturnType<typeof userEvent.setup>,
  values: { name: string; email: string; password: string },
) => {
  await user.click(screen.getByRole('button', { name: /new user/i }))
  const dialog = await screen.findByRole('dialog')
  await user.type(within(dialog).getByLabelText('Name'), values.name)
  await user.type(within(dialog).getByLabelText('Email'), values.email)
  await user.type(within(dialog).getByLabelText('Password'), values.password)
  return dialog
}

describe('CreateUserDialog', () => {
  it('posts the form values and closes the dialog on success', async () => {
    mockedPost.mockResolvedValue({
      data: {
        id: '1',
        name: 'New Agent',
        email: 'agent@example.com',
        role: 'agent',
      },
    })
    const user = userEvent.setup()

    renderWithQueryClient(<CreateUserDialog />)

    const dialog = await openAndFill(user, {
      name: 'New Agent',
      email: 'agent@example.com',
      password: 'secret77',
    })
    await user.click(within(dialog).getByRole('button', { name: /create user/i }))

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith('/api/users', {
        name: 'New Agent',
        email: 'agent@example.com',
        password: 'secret77',
      }),
    )
    // The dialog closes once the mutation succeeds.
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
  })

  it('shows validation errors and does not submit when fields are invalid', async () => {
    const user = userEvent.setup()

    renderWithQueryClient(<CreateUserDialog />)

    await user.click(screen.getByRole('button', { name: /new user/i }))
    const dialog = await screen.findByRole('dialog')

    // Submit an empty form — client-side (zod) validation should block it.
    await user.click(within(dialog).getByRole('button', { name: /create user/i }))

    expect(
      await within(dialog).findByText('Name must be at least 3 characters'),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText('Enter a valid email address'),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText('Password must be at least 7 characters'),
    ).toBeInTheDocument()
    expect(mockedPost).not.toHaveBeenCalled()
  })

  it('shows the server error message and keeps the dialog open when the request fails', async () => {
    mockedIsAxiosError.mockReturnValue(true)
    mockedPost.mockRejectedValue({
      response: { data: { error: 'A user with this email already exists' } },
    })
    const user = userEvent.setup()

    renderWithQueryClient(<CreateUserDialog />)

    const dialog = await openAndFill(user, {
      name: 'Dupe User',
      email: 'dupe@example.com',
      password: 'secret77',
    })
    await user.click(within(dialog).getByRole('button', { name: /create user/i }))

    expect(
      await within(dialog).findByText('A user with this email already exists'),
    ).toBeInTheDocument()
    // The dialog stays open so the user can correct and retry.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
