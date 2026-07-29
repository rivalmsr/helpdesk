import type { ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { useSession, type Role } from './lib/auth-client'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import UsersPage from './pages/UsersPage'
import NavBar from './components/NavBar'

function AuthedLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <NavBar />
      <main className="mx-auto w-full max-w-6xl px-4 py-4">{children}</main>
    </>
  )
}

type ProtectedRouteProps = {
  children: ReactNode
  role?: Role
}

/** Assumes the caller has already resolved `useSession()`'s pending state. */
function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const { data: session } = useSession()

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (role && session.user.role !== role) {
    return <Navigate to="/" replace />
  }

  return <AuthedLayout>{children}</AuthedLayout>
}

function AppRoutes() {
  const { data: session, isPending } = useSession()

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        Loading…
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={session ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute role="admin">
            <UsersPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
