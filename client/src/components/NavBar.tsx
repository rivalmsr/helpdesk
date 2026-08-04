import { Link, NavLink, useNavigate } from 'react-router'
import { LifeBuoy, Sun, Moon, Monitor } from 'lucide-react'
import { ROLE } from 'core'
import { Button } from '@/components/ui/button'
import { useSession, signOut } from '../lib/auth-client'
import { useTheme, type Theme } from '../lib/theme'

// Single source of truth for nav link styling. NavLink calls this with its
// active state: the active item gets a cobalt-tinted pill, others stay muted
// until hovered — a quiet, scannable indicator that doesn't fight the content.
function navLinkClassName({ isActive }: { isActive: boolean }) {
  return `rounded-md px-2.5 py-1.5 text-sm transition-colors ${
    isActive
      ? 'bg-primary/10 font-medium text-primary'
      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
  }`
}

// Cycle order for the theme control; the button advances through it and shows
// the icon for the current setting.
const THEME_CYCLE: Record<Theme, Theme> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
}
const THEME_ICON = { light: Sun, dark: Moon, system: Monitor }

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const Icon = THEME_ICON[theme]
  const next = THEME_CYCLE[theme]
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${theme}. Switch to ${next}.`}
      title={`Theme: ${theme}`}
    >
      <Icon aria-hidden />
    </Button>
  )
}

function NavBar() {
  const { data: session } = useSession()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <nav className="border-b border-border bg-background">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <LifeBuoy className="size-4" aria-hidden />
            </span>
            Helpdesk
          </Link>
          <div className="flex items-center gap-1">
            <NavLink to="/" end className={navLinkClassName}>
              Dashboard
            </NavLink>
            <NavLink to="/tickets" className={navLinkClassName}>
              Tickets
            </NavLink>
            {session?.user.role === ROLE.admin && (
              <NavLink to="/users" className={navLinkClassName}>
                Users
              </NavLink>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {session?.user.name}
          </span>
          <ThemeToggle />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSignOut}
          >
            Sign out
          </Button>
        </div>
      </div>
    </nav>
  )
}

export default NavBar
