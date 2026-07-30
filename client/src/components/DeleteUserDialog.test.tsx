import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axios from 'axios'
import { renderWithQueryClient } from '@/test/render'
import DeleteUserDialog from './DeleteUserDialog'

// DeleteUserDialog submits through axios.delete; mock the module so no real
// request is made. `isAxiosError` gates the server-error branch in the component.
vi.mock('axios', () => ({
  default: {
    delete: vi.fn(),
    isAxiosError: vi.fn(),
  },
}))

const mockedDelete = vi.mocked(axios.delete)
const mockedIsAxiosError = vi.mocked(axios.isAxiosError)

const testUser = { id: 'u1', name: 'Aggie Agent' }

beforeEach(() => {
  mockedDelete.mockReset()
  mockedIsAxiosError.mockReset()
})

// Opens the dialog via the row's trash button and returns the dialog element.
// Awaiting the dialog fails loudly if it never opened.
const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: /delete aggie agent/i }))
  return screen.findByRole('dialog')
}

describe('DeleteUserDialog', () => {
  it('asks for confirmation naming the user without deleting anything yet', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<DeleteUserDialog user={testUser} />)

    const dialog = await openDialog(user)

    expect(
      within(dialog).getByText(/delete Aggie Agent\?/i),
    ).toBeInTheDocument()
    // Merely opening the confirmation must not fire the request.
    expect(mockedDelete).not.toHaveBeenCalled()
  })

  it('deletes the user and closes the dialog on success', async () => {
    mockedDelete.mockResolvedValue({})
    const user = userEvent.setup()
    renderWithQueryClient(<DeleteUserDialog user={testUser} />)

    const dialog = await openDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() =>
      expect(mockedDelete).toHaveBeenCalledWith('/api/users/u1'),
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
  })

  it('shows the server error message and keeps the dialog open when the request fails', async () => {
    mockedIsAxiosError.mockReturnValue(true)
    mockedDelete.mockRejectedValue({
      response: { data: { error: 'Admin users cannot be deleted' } },
    })
    const user = userEvent.setup()
    renderWithQueryClient(<DeleteUserDialog user={testUser} />)

    const dialog = await openDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(
      await within(dialog).findByText('Admin users cannot be deleted'),
    ).toBeInTheDocument()
    // The dialog stays open so the failure is visible.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
