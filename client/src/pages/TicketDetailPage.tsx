import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import axios from 'axios'
import { ArrowLeft } from 'lucide-react'
import { TICKET_STATUSES, TICKET_CATEGORIES } from 'core'
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
import { TicketFieldSelect } from '@/components/TicketFieldSelect'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/format'
import {
  STATUS_LABEL,
  CATEGORY_LABEL,
  MESSAGE_TYPE_LABEL,
} from '@/lib/ticketMeta'

// Static option lists for the status/category selects, built from the shared
// enums + their labels (single source of truth in ticketMeta).
const STATUS_OPTIONS = TICKET_STATUSES.map((value) => ({
  value,
  label: STATUS_LABEL[value],
}))
const CATEGORY_OPTIONS = TICKET_CATEGORIES.map((value) => ({
  value,
  label: CATEGORY_LABEL[value],
}))

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
          <Skeleton className="mt-3 h-4 w-96" />
          <div className="mt-4 flex flex-wrap gap-6">
            <Skeleton className="h-13 w-40" />
            <Skeleton className="h-13 w-40" />
            <Skeleton className="h-13 w-40" />
          </div>
        </div>
      )}

      {!isError && !isPending && (
        <>
          {/* Plain header block (no Card chrome) so it reads as the page title
              area, distinct from the message Cards below. */}
          <header className="border-b pb-5">
            <h1 className="text-2xl font-semibold tracking-tight">
              {ticket.subject}
            </h1>

            {/* Read-only metadata, as a compact inline line under the title. */}
            <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              <div className="flex gap-1.5">
                <dt>Requester</dt>
                <dd className="font-medium text-foreground">
                  {ticket.requesterEmail}
                </dd>
              </div>
              <div className="flex gap-1.5">
                <dt>Opened</dt>
                <dd className="font-medium text-foreground">
                  {formatDateTime(ticket.createdAt)}
                </dd>
              </div>
            </dl>

            {/* Editable controls, aligned in their own row so the selects line up. */}
            <div className="mt-4 flex flex-wrap items-start gap-x-6 gap-y-3">
              <div>
                <div className="text-sm text-muted-foreground">Status</div>
                <div className="mt-1">
                  <TicketFieldSelect
                    ticketId={ticket.id}
                    field="status"
                    value={ticket.status}
                    options={STATUS_OPTIONS}
                    ariaLabel="Change status"
                  />
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Category</div>
                <div className="mt-1">
                  <TicketFieldSelect
                    ticketId={ticket.id}
                    field="category"
                    value={ticket.category}
                    options={CATEGORY_OPTIONS}
                    ariaLabel="Change category"
                  />
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Assigned To</div>
                <div className="mt-1 text-sm font-medium">
                  <TicketAssignee
                    ticketId={ticket.id}
                    assignee={ticket.assignee}
                  />
                </div>
              </div>
            </div>
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
