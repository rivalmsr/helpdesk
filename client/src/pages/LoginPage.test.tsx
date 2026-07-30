import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { signIn } from '@/lib/auth-client'
import LoginPage from './LoginPage'

// LoginPage submits via signIn.email; mock the auth boundary so no real request
// fires and "did it submit?" can be asserted. useNavigate comes from the real
// react-router, satisfied by the MemoryRouter wrapper below.
vi.mock('@/lib/auth-client', () => ({
  signIn: { email: vi.fn() },
}))

const mockedSignIn = vi.mocked(signIn.email)

const renderLoginPage = () =>
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  )

beforeEach(() => {
  mockedSignIn.mockReset()
})

describe('LoginPage', () => {
  it('renders the sign-in form', () => {
    renderLoginPage()

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('exposes no sign-up or register link', () => {
    renderLoginPage()

    expect(
      screen.queryByRole('link', { name: /sign up|register/i }),
    ).not.toBeInTheDocument()
  })

  it('blocks submission and shows an error for an invalid email', async () => {
    const user = userEvent.setup()
    renderLoginPage()

    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.type(screen.getByLabelText('Password'), 'some-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(
      await screen.findByText('Enter a valid email address'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Password is required')).not.toBeInTheDocument()
    expect(mockedSignIn).not.toHaveBeenCalled()
  })

  it('blocks submission and shows an error for an empty password', async () => {
    const user = userEvent.setup()
    renderLoginPage()

    await user.type(screen.getByLabelText('Email'), 'admin@example.com')
    // Leave password blank.
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Password is required')).toBeInTheDocument()
    expect(
      screen.queryByText('Enter a valid email address'),
    ).not.toBeInTheDocument()
    expect(mockedSignIn).not.toHaveBeenCalled()
  })

  it('shows both field errors when the form is empty', async () => {
    const user = userEvent.setup()
    renderLoginPage()

    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(
      await screen.findByText('Enter a valid email address'),
    ).toBeInTheDocument()
    expect(screen.getByText('Password is required')).toBeInTheDocument()
    expect(mockedSignIn).not.toHaveBeenCalled()
  })
})
