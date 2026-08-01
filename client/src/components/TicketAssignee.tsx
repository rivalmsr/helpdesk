import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { ROLE } from 'core'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSession } from '@/lib/auth-client'
import { getServerErrorMessage } from '@/lib/http'
import type { TicketDetail } from '@/pages/TicketDetailPage'

// UI-only sentinel for the "Unassigned" option — base-ui's Select value must be
// a string, so `null` (unassign) is represented by this value in the control and
// mapped back to `null` on change.
const UNASSIGNED = 'unassigned'

type Agent = { id: string; name: string; email: string }

// The "Assigned To" control on the ticket detail page. Admins get an inline,
// instant-save agent picker; anyone non-admin sees the assignee read-only.
export function TicketAssignee({
  ticketId,
  assignee,
}: {
  ticketId: string
  assignee: Agent | null
}) {
  const { data: session } = useSession()
  const isAdmin = session?.user.role === ROLE.admin

  const queryClient = useQueryClient()
  const [assignError, setAssignError] = useState<string | null>(null)

  // The assignable agents for the picker — only fetched for admins.
  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const res = await axios.get<Agent[]>('/api/agents')
      return res.data
    },
    enabled: isAdmin,
  })

  const assignMutation = useMutation({
    mutationFn: async (assigneeId: string | null) => {
      const res = await axios.patch<TicketDetail>(`/api/tickets/${ticketId}`, {
        assigneeId,
      })
      return res.data
    },
    onSuccess: (updated) => {
      setAssignError(null)
      // Drop the fresh ticket straight into the detail cache, and refresh the
      // list so its data doesn't go stale.
      queryClient.setQueryData(['ticket', ticketId], updated)
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
    onError: (err) => {
      setAssignError(getServerErrorMessage(err, 'Failed to assign ticket'))
    },
  })

  if (!isAdmin) {
    return assignee ? (
      <>{assignee.name}</>
    ) : (
      <span className="font-normal text-muted-foreground italic">Unassigned</span>
    )
  }

  return (
    <>
      <Select
        value={assignee?.id ?? UNASSIGNED}
        onValueChange={(next) =>
          assignMutation.mutate(
            (next as string) === UNASSIGNED ? null : (next as string),
          )
        }
        disabled={assignMutation.isPending}
      >
        <SelectTrigger size="sm" className="min-w-44" aria-label="Assign to">
          <SelectValue>
            {(selected: string | null) =>
              selected && selected !== UNASSIGNED
                ? (agents?.find((a) => a.id === selected)?.name ?? assignee?.name)
                : 'Unassigned'
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
          {agents?.map((agent) => (
            <SelectItem key={agent.id} value={agent.id}>
              {agent.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {assignError && (
        <p className="mt-1 text-xs text-destructive">{assignError}</p>
      )}
    </>
  )
}
