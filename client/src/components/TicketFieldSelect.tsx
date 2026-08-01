import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getServerErrorMessage } from '@/lib/http'
import type { TicketDetail } from '@/pages/TicketDetailPage'

type Option<T extends string> = { value: T; label: string }

// An inline, instant-save select for one of a ticket's enum fields (status /
// category). Picking a value PATCHes just that field and drops the fresh ticket
// into the detail cache. Available to any authenticated user (triage workflow).
export function TicketFieldSelect<T extends string>({
  ticketId,
  field,
  value,
  options,
  ariaLabel,
}: {
  ticketId: string
  field: 'status' | 'category'
  value: T
  options: Option<T>[]
  ariaLabel: string
}) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async (next: T) => {
      const res = await axios.patch<TicketDetail>(`/api/tickets/${ticketId}`, {
        [field]: next,
      })
      return res.data
    },
    onSuccess: (updated) => {
      setError(null)
      queryClient.setQueryData(['ticket', ticketId], updated)
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
    onError: (err) => {
      setError(getServerErrorMessage(err, 'Failed to update ticket'))
    },
  })

  return (
    <>
      <Select
        value={value}
        onValueChange={(next) => mutation.mutate(next as T)}
        disabled={mutation.isPending}
      >
        <SelectTrigger size="sm" className="min-w-40" aria-label={ariaLabel}>
          <SelectValue>
            {(selected: string | null) =>
              options.find((o) => o.value === selected)?.label
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </>
  )
}
