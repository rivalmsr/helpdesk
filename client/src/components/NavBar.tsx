import { Link, useNavigate } from 'react-router'
import { useSession, signOut } from '../lib/auth-client'

function NavBar() {
  const { data: session } = useSession()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <nav className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
      <div className="flex items-center gap-4">
        <Link to="/" className="font-semibold">
          Helpdesk
        </Link>
        {session?.user.role === 'admin' && (
          <Link to="/users" className="text-sm text-gray-600 hover:text-gray-900">
            Users
          </Link>
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
    </nav>
  )
}

export default NavBar
