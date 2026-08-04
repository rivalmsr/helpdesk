import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

// User-selectable theme. `system` follows the OS preference and updates live.
export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'helpdesk-theme'

// The same key/logic runs in the anti-FOUC inline script in `index.html`, which
// applies the class before the bundle loads. Keep the two in sync.
function readStored(): Theme {
  if (typeof localStorage === 'undefined') return 'system'
  const value = localStorage.getItem(STORAGE_KEY)
  return value === 'light' || value === 'dark' || value === 'system'
    ? value
    : 'system'
}

function systemPrefersDark(): boolean {
  return (
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-color-scheme: dark)').matches
  )
}

// Toggle the `.dark` class + `color-scheme` on <html> so Tailwind's `dark:`
// variant, native form controls, scrollbars, and the autofill override in
// index.css all follow the resolved theme.
function applyResolved(isDark: boolean) {
  const root = document.documentElement
  root.classList.toggle('dark', isDark)
  root.style.colorScheme = isDark ? 'dark' : 'light'
}

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'light' | 'dark'
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStored)
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() =>
    (theme === 'system' ? systemPrefersDark() : theme === 'dark')
      ? 'dark'
      : 'light',
  )

  useEffect(() => {
    const mql = matchMedia('(prefers-color-scheme: dark)')
    const resolve = () => {
      const isDark = theme === 'system' ? mql.matches : theme === 'dark'
      applyResolved(isDark)
      setResolvedTheme(isDark ? 'dark' : 'light')
    }
    resolve()
    // Only the `system` setting needs to react to OS changes.
    if (theme !== 'system') return
    mql.addEventListener('change', resolve)
    return () => mql.removeEventListener('change', resolve)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem(STORAGE_KEY, next)
    setThemeState(next)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
