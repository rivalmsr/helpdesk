import { ROLE } from 'core'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import EditUserDialog from '@/components/EditUserDialog'
import DeleteUserDialog from '@/components/DeleteUserDialog'
import { formatDate } from '@/lib/format'
import type { User } from '@/pages/UsersPage'

// The user list table: a row per user (name, email, role badge, created date,
// and edit/delete actions), or skeleton rows while `isPending`. Admins can't be
// deleted, so the delete action is hidden for them (also enforced server-side).
export function UsersTable({
  users,
  isPending,
}: {
  users: User[]
  isPending: boolean
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isPending
          ? Array.from({ length: 3 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-40" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-14 rounded-4xl" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="ml-auto h-8 w-8" />
              </TableCell>
            </TableRow>
          ))
          : users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {user.email}
              </TableCell>
              <TableCell>
                <Badge
                  variant="secondary"
                  className={
                    user.role === ROLE.admin
                      ? 'bg-blue-100 capitalize text-blue-700 dark:bg-blue-400/10 dark:text-blue-300'
                      : 'capitalize'
                  }
                >
                  {user.role}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(user.createdAt)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <EditUserDialog user={user} />
                  {/* Admins can't be deleted (also enforced server-side). */}
                  {user.role !== ROLE.admin && <DeleteUserDialog user={user} />}
                </div>
              </TableCell>
            </TableRow>
          ))}
      </TableBody>
    </Table>
  )
}
