import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Sparkles } from 'lucide-react'
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
    setValue,
    getValues,
    watch,
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

  // Sends the current draft to the AI polish endpoint and replaces the textarea
  // with the improved text (via setValue — the field is uncontrolled/registered).
  const polishMutation = useMutation({
    mutationFn: async () => {
      const res = await axios.post<{ text: string }>(
        `/api/tickets/${ticketId}/polish-reply`,
        { body: getValues('body') },
      )
      return res.data.text
    },
    onSuccess: (text) => {
      setValue('body', text, { shouldValidate: true, shouldDirty: true })
    },
  })

  const body = watch('body')
  const isBusy = mutation.isPending || polishMutation.isPending

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
        {polishMutation.isError && (
          <FieldError>
            {getServerErrorMessage(polishMutation.error, 'Failed to polish reply')}
          </FieldError>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => polishMutation.mutate()}
            disabled={isBusy || !body?.trim()}
          >
            <Sparkles className="size-4" />
            {polishMutation.isPending ? 'Polishing…' : 'Polish'}
          </Button>
          <Button type="submit" disabled={isBusy}>
            {mutation.isPending ? 'Sending…' : 'Send reply'}
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}
