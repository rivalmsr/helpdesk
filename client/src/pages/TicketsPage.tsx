import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import {
  TICKET_STATUS,
  TICKET_CATEGORY,
  type TicketStatus,
  type TicketCategory,
} from 'core'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/format'

type Ticket = {
  id: string
  subject: string
  requesterEmail: string
  status: TicketStatus
  category: TicketCategory
  createdAt: string
  updatedAt: string
  _count: { messages: number }
}

// Friendly, human-readable labels for the enum values (see project-scope.md).
// Keys reference the `core` constants (the single source of truth) rather than
// bare strings, so these maps track the enum instead of duplicating it.
const STATUS_LABEL: Record<TicketStatus, string> = {
  [TICKET_STATUS.open]: 'Open',
  [TICKET_STATUS.resolved]: 'Resolved',
  [TICKET_STATUS.closed]: 'Closed',
}

const STATUS_VARIANT: Record<TicketStatus, 'default' | 'secondary' | 'outline'> =
  {
    [TICKET_STATUS.open]: 'default',
    [TICKET_STATUS.resolved]: 'secondary',
    [TICKET_STATUS.closed]: 'outline',
  }

const CATEGORY_LABEL: Record<TicketCategory, string> = {
  [TICKET_CATEGORY.general]: 'General Question',
  [TICKET_CATEGORY.technical]: 'Technical Question',
  [TICKET_CATEGORY.refund]: 'Refund Request',
}

function TicketsPage() {
  const {
    data: tickets,
    isPending,
    isError,
  } = useQuery({
    // The API returns tickets newest-first (order by createdAt desc), so the
    // list renders in that order without any client-side sorting.
    queryKey: ['tickets'],
    queryFn: async () => {
      const res = await axios.get<Ticket[]>('/api/tickets')
      return res.data
    },
    retry: 3,
  })

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={1}>
            Tickets
          </CardTitle>
          <CardDescription>
            Support tickets created from incoming email, newest first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isError && (
            <p className="text-sm text-destructive">Failed to load tickets</p>
          )}
          {!isError && tickets && tickets.length === 0 && (
            <p className="text-sm text-muted-foreground">No tickets yet.</p>
          )}
          {!isError && (isPending || tickets.length > 0) && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Messages</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPending
                  ? Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-48" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-40" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-16 rounded-4xl" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-28 rounded-4xl" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="ml-auto h-4 w-6" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                    </TableRow>
                  ))
                  : tickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-medium">
                        {ticket.subject}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {ticket.requesterEmail}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[ticket.status]}>
                          {STATUS_LABEL[ticket.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {CATEGORY_LABEL[ticket.category]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {ticket._count.messages}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(ticket.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default TicketsPage
