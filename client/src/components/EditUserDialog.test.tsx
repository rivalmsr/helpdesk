import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axios from 'axios'
import { renderWithQueryClient } from '@/test/render'
import EditUserDialog from './EditUserDialog'

// EditUserDialog submits through axios.patch; mock the module so no real
// request is made. `isAxiosError` gates the server-error branch.
vi.mock('axios', () => ({
  default: {
    patch: vi.fn(),
    isAxiosError: vi.fn(),
  },
}))

const mockedPatch = vi.mocked(axios.patch)
const mockedIsAxiosError = vi.mocked(axios.isAxiosError)

const testUser = { id: 'u1', name: 'Ada Admin', email: 'ada@example.com' }

beforeEach(() => {
  mockedPatch.mockReset()
  mockedIsAxiosError.mockReset()
})

// Opens the dialog via the row's edit button and returns the dialog element.
// Awaiting the dialog fails loudly if it never opened.
const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: /edit ada admin/i }))
  return screen.findByRole('dialog')
}

describe('EditUserDialog', () => {
  it('populates the form with the user data when opened', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<EditUserDialog user={testUser} />)

    const dialog = await openDialog(user)

    expect(within(dialog).getByLabelText('Name')).toHaveValue('Ada Admin')
    expect(within(dialog).getByLabelText('Email')).toHaveValue('ada@example.com')
    // Password starts blank — it's only sent when the admin types a new one.
    expect(within(dialog).getByLabelText('New password')).toHaveValue('')
  })

  it('patches the updated name and email (blank password) and closes on success', async () => {
    mockedPatch.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    renderWithQueryClient(<EditUserDialog user={testUser} />)

    const dialog = await openDialog(user)
    const name = within(dialog).getByLabelText('Name')
    await user.clear(name)
    await user.type(name, 'Ada Updated')
    await user.click(within(dialog).getByRole('button', { name: /save changes/i }))

    await waitFor(() =>
      expect(mockedPatch).toHaveBeenCalledWith('/api/users/u1', {
        name: 'Ada Updated',
        email: 'ada@example.com',
        password: '',
      }),
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
  })

  it('includes the new password in the request when one is entered', async () => {
    mockedPatch.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    renderWithQueryClient(<EditUserDialog user={testUser} />)

    const dialog = await openDialog(user)
    await user.type(within(dialog).getByLabelText('New password'), 'newsecret1')
    await user.click(within(dialog).getByRole('button', { name: /save changes/i }))

    await waitFor(() =>
      expect(mockedPatch).toHaveBeenCalledWith('/api/users/u1', {
        name: 'Ada Admin',
        email: 'ada@example.com',
        password: 'newsecret1',
      }),
    )
  })

  it('shows a validation error and does not submit when the new password is too short', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<EditUserDialog user={testUser} />)

    const dialog = await openDialog(user)
    await user.type(within(dialog).getByLabelText('New password'), 'short')
    await user.click(within(dialog).getByRole('button', { name: /save changes/i }))

    expect(
      await within(dialog).findByText('Password must be at least 7 characters'),
    ).toBeInTheDocument()
    expect(mockedPatch).not.toHaveBeenCalled()
  })

  it('shows the server error message and keeps the dialog open when the request fails', async () => {
    mockedIsAxiosError.mockReturnValue(true)
    mockedPatch.mockRejectedValue({
      response: { data: { error: 'A user with this email already exists' } },
    })
    const user = userEvent.setup()
    renderWithQueryClient(<EditUserDialog user={testUser} />)

    const dialog = await openDialog(user)
    await user.click(within(dialog).getByRole('button', { name: /save changes/i }))

    expect(
      await within(dialog).findByText('A user with this email already exists'),
    ).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
