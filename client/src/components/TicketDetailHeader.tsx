import {
  AGENT_TICKET_STATUSES,
  TICKET_CATEGORIES,
  type TicketStatus,
} from 'core'
import { TicketAssignee } from '@/components/TicketAssignee'
import { TicketFieldSelect } from '@/components/TicketFieldSelect'
import { formatDateTime } from '@/lib/format'
import { STATUS_LABEL, CATEGORY_LABEL } from '@/lib/ticketMeta'
import type { TicketDetail } from '@/pages/TicketDetailPage'

// Option lists for the status/category selects, built from the shared enums +
// their labels (single source of truth in ticketMeta). Agents may only set the
// agent-facing statuses (open/resolved/closed) — the AI-owned ones
// (new/processing/ai_resolved) are driven by the triage pipeline.
const AGENT_STATUS_OPTIONS = AGENT_TICKET_STATUSES.map((value) => ({
  value: value as TicketStatus,
  label: STATUS_LABEL[value],
}))
const CATEGORY_OPTIONS = TICKET_CATEGORIES.map((value) => ({
  value,
  label: CATEGORY_LABEL[value],
}))

// The status options for a given ticket: the agent-settable statuses, plus — when
// the ticket is currently in an AI-owned status — that status as a disabled entry
// so the select still displays its label (e.g. "AI Resolved") without letting an
// agent pick it (the API would reject it anyway).
function statusOptionsFor(status: TicketStatus) {
  const isAgentStatus = (AGENT_TICKET_STATUSES as readonly TicketStatus[]).includes(
    status,
  )
  return isAgentStatus
    ? AGENT_STATUS_OPTIONS
    : [
        { value: status, label: STATUS_LABEL[status], disabled: true },
        ...AGENT_STATUS_OPTIONS,
      ]
}

// The ticket detail page's title area: subject, read-only requester/opened
// metadata, and the editable status/category/assignee controls. A plain block
// (no Card chrome) so it reads as the page header, distinct from the message
// Cards below.
export function TicketDetailHeader({ ticket }: { ticket: TicketDetail }) {
  return (
    <header className="border-b pb-5">
      <h1 className="text-2xl font-semibold tracking-tight">{ticket.subject}</h1>

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
        <div className="flex gap-1.5">
          <dt>Updated</dt>
          <dd className="font-medium text-foreground">
            {formatDateTime(ticket.updatedAt)}
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
              options={statusOptionsFor(ticket.status)}
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
            <TicketAssignee ticketId={ticket.id} assignee={ticket.assignee} />
          </div>
        </div>
      </div>
    </header>
  )
}
