import { useEffect, useState } from 'react'
import type { Role } from '@/lib/auth-client'

type User = {
  id: string
  name: string
  email: string
  role: Role
}

function UsersPage() {
  const [users, setUsers] = useState<User[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/users')
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`)
        return res.json()
      })
      .then(setUsers)
      .catch(() => setError('Failed to load users'))
  }, [])

  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="text-2xl font-semibold text-center">Users</h1>
      {error && <p className="mt-4 text-center text-red-500">{error}</p>}
      {!error && !users && <p className="mt-4 text-center text-gray-500">Loading…</p>}
      {users && (
        <ul className="mt-4 space-y-2">
          {users.map((user) => (
            <li key={user.id} className="rounded border p-2">
              <div className="font-medium">{user.name}</div>
              <div className="text-sm text-gray-500">
                {user.email} · {user.role}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

export default UsersPage
