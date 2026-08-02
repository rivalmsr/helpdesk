import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getServerErrorMessage } from '@/lib/http'

// An on-demand AI summary of the ticket and its conversation history. Clicking
// "Summarize" POSTs to the summarize endpoint and shows the returned brief;
// every click regenerates it (nothing is stored — the endpoint holds no state).
export function TicketSummary({ ticketId }: { ticketId: string }) {
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await axios.post<{ summary: string }>(
        `/api/tickets/${ticketId}/summarize`,
      )
      return res.data.summary
    },
  })

  return (
    <div className="mt-4">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        <Sparkles className="size-4" />
        {mutation.isPending
          ? 'Summarizing…'
          : mutation.data
            ? 'Regenerate summary'
            : 'Summarize'}
      </Button>

      {mutation.isError && (
        <p className="mt-2 text-sm text-destructive">
          {getServerErrorMessage(mutation.error, 'Failed to summarize ticket')}
        </p>
      )}

      {mutation.data && (
        <Card className="mt-3">
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{mutation.data}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
