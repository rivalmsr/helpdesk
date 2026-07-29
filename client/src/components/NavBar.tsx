import { Link, NavLink, useNavigate } from 'react-router'
import { useSession, signOut } from '../lib/auth-client'

function NavBar() {
  const { data: session } = useSession()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <nav className="border-b border-gray-200">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <Link to="/" className="font-semibold">
            Helpdesk
          </Link>
          {session?.user.role === 'admin' && (
            <NavLink
              to="/users"
              className={({ isActive }) =>
                `text-sm ${
                  isActive
                    ? 'font-medium text-gray-900'
                    : 'text-gray-600 hover:text-gray-900'
                }`
              }
            >
              Users
            </NavLink>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">{session?.user.name}</span>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded bg-gray-200 px-3 py-1.5 text-sm hover:bg-gray-300"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  )
}

export default NavBar
