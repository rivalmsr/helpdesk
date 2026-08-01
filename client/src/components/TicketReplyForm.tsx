import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import {
  createReplySchema,
  TICKET_BODY_MAX_LENGTH,
  type CreateReplyInput,
} from 'core'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { getServerErrorMessage } from '@/lib/http'
import type { TicketDetail } from '@/pages/TicketDetailPage'

// The reply composer below a ticket's thread. Submitting POSTs an agent reply
// and drops the updated ticket (thread + new message) straight into the detail
// cache, so the thread re-renders without a refetch. Available to any agent.
export function TicketReplyForm({ ticketId }: { ticketId: string }) {
  const queryClient = useQueryClient()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateReplyInput>({ resolver: zodResolver(createReplySchema) })

  const mutation = useMutation({
    mutationFn: async (values: CreateReplyInput) => {
      const res = await axios.post<TicketDetail>(
        `/api/tickets/${ticketId}/messages`,
        values,
      )
      return res.data
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['ticket', ticketId], updated)
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      reset({ body: '' })
    },
  })

  return (
    <form
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      noValidate
    >
      <FieldGroup>
        <Field data-invalid={!!errors.body}>
          <FieldLabel htmlFor="reply-body">Reply</FieldLabel>
          <Textarea
            id="reply-body"
            rows={4}
            maxLength={TICKET_BODY_MAX_LENGTH}
            placeholder="Write a reply…"
            aria-invalid={!!errors.body}
            {...register('body')}
          />
          <FieldError errors={errors.body ? [errors.body] : undefined} />
        </Field>
        {mutation.isError && (
          <FieldError>
            {getServerErrorMessage(mutation.error, 'Failed to send reply')}
          </FieldError>
        )}
        <div>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Sending…' : 'Send reply'}
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}
