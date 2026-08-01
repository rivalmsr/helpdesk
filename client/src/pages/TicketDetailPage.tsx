import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import axios from 'axios'
import { ArrowLeft } from 'lucide-react'
import type { TicketStatus, TicketCategory, TicketMessageType } from 'core'
import { buttonVariants } from '@/components/ui/button'
import { TicketDetailHeader } from '@/components/TicketDetailHeader'
import { TicketDetailSkeleton } from '@/components/TicketDetailSkeleton'
import { TicketMessageCard } from '@/components/TicketMessageCard'
import { TicketReplyForm } from '@/components/TicketReplyForm'
import { cn } from '@/lib/utils'

// One entry in a ticket's message thread. Exported for `TicketMessageCard`,
// which renders a single message.
export type TicketMessage = {
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

      {isPending && <TicketDetailSkeleton />}

      {!isError && !isPending && (
        <>
          <TicketDetailHeader ticket={ticket} />

          <div className="mt-4 space-y-3">
            {ticket.messages.map((message) => (
              <TicketMessageCard key={message.id} message={message} />
            ))}
          </div>

          {/* Reply composer, below the thread. */}
          <div className="mt-6 border-t pt-6">
            <TicketReplyForm ticketId={ticket.id} />
          </div>
        </>
      )}
    </div>
  )
}

export default TicketDetailPage
