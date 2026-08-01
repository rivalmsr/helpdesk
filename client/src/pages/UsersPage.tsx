import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import type { Role } from 'core'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import CreateUserDialog from '@/components/CreateUserDialog'
import { UsersTable } from '@/components/UsersTable'

// One row in the user list (`GET /api/users`). Exported for `UsersTable`, which
// renders the rows.
export type User = {
  id: string
  name: string
  email: string
  role: Role
  createdAt: string
}

function UsersPage() {
  const {
    data: users,
    isPending,
    isError,
  } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await axios.get<User[]>('/api/users')
      return res.data
    },
    retry: 3,
  })

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={1}>
            Users
          </CardTitle>
          <CardDescription>Everyone with access to the helpdesk.</CardDescription>
          <CardAction>
            <CreateUserDialog />
          </CardAction>
        </CardHeader>
        <CardContent>
          {isError && (
            <p className="text-sm text-destructive">Failed to load users</p>
          )}
          {!isError && users && users.length === 0 && (
            <p className="text-sm text-muted-foreground">No users found.</p>
          )}
          {!isError && (isPending || users.length > 0) && (
            <UsersTable users={users ?? []} isPending={isPending} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default UsersPage
