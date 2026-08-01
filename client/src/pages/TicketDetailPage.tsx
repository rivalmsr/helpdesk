import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import axios from 'axios'
import { ArrowLeft } from 'lucide-react'
import type { TicketStatus, TicketCategory, TicketMessageType } from 'core'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TicketAssignee } from '@/components/TicketAssignee'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/format'
import {
  STATUS_LABEL,
  STATUS_VARIANT,
  CATEGORY_LABEL,
  MESSAGE_TYPE_LABEL,
} from '@/lib/ticketMeta'

type TicketMessage = {
  id: string
  type: TicketMessageType
  fromEmail: string
  body: string
  createdAt: string
}

// The single-ticket shape returned by `GET /api/tickets/:id` (with its thread).
// `assignee` is null while the ticket is unassigned.
export type TicketDetail = {
  id: string
  subject: string
  requesterEmail: string
  status: TicketStatus
  category: TicketCategory
  assignee: { id: string; name: string; email: string } | null
  createdAt: string
  updatedAt: string
  messages: TicketMessage[]
}

function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()

  const {
    data: ticket,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ['ticket', id],
    queryFn: async () => {
      const res = await axios.get<TicketDetail>(`/api/tickets/${id}`)
      return res.data
    },
    // A missing ticket won't appear on a retry, so don't spend retries on a 404.
    retry: (failureCount, err) =>
      axios.isAxiosError(err) && err.response?.status === 404
        ? false
        : failureCount < 3,
  })

  const notFound =
    axios.isAxiosError(error) && error.response?.status === 404

  return (
    <div>
      <Link
        to="/tickets"
        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'mb-4')}
      >
        <ArrowLeft className="size-4" />
        Back to tickets
      </Link>

      {isError && (
        <p className="text-sm text-destructive">
          {notFound ? 'Ticket not found.' : 'Failed to load ticket'}
        </p>
      )}

      {isPending && (
        <div className="border-b pb-5">
          <Skeleton className="h-8 w-72" />
          <div className="mt-4 flex gap-8">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-9 w-40" />
          </div>
        </div>
      )}

      {!isError && !isPending && (
        <>
          {/* Plain header block (no Card chrome) so it reads as the page title
              area, distinct from the message Cards below. */}
          <header className="border-b pb-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">
                {ticket.subject}
              </h1>
              <div className="flex shrink-0 gap-2">
                <Badge variant={STATUS_VARIANT[ticket.status]}>
                  {STATUS_LABEL[ticket.status]}
                </Badge>
                <Badge variant="outline">
                  {CATEGORY_LABEL[ticket.category]}
                </Badge>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Requester</dt>
                <dd className="mt-0.5 font-medium">{ticket.requesterEmail}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Assigned To</dt>
                <dd className="mt-0.5 font-medium">
                  <TicketAssignee
                    ticketId={ticket.id}
                    assignee={ticket.assignee}
                  />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Opened</dt>
                <dd className="mt-0.5 font-medium">
                  {formatDateTime(ticket.createdAt)}
                </dd>
              </div>
            </dl>
          </header>

          <div className="mt-4 space-y-3">
            {ticket.messages.map((message) => (
              <Card key={message.id}>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    {message.fromEmail}
                  </CardTitle>
                  <CardDescription>
                    {formatDateTime(message.createdAt)}
                  </CardDescription>
                  <CardAction>
                    <Badge variant="outline">
                      {MESSAGE_TYPE_LABEL[message.type]}
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default TicketDetailPage
