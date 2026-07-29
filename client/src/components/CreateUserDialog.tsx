import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createUserSchema, type CreateUserInput } from 'core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

type CreateUserFormValues = CreateUserInput

function CreateUserDialog() {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUserFormValues>({ resolver: zodResolver(createUserSchema) })

  const mutation = useMutation({
    mutationFn: async (values: CreateUserFormValues) => {
      const res = await axios.post('/api/users', values)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      reset()
      setServerError(null)
      setOpen(false)
    },
    onError: (error) => {
      const message = axios.isAxiosError(error)
        ? (error.response?.data?.error ?? 'Failed to create user')
        : 'Failed to create user'
      setServerError(message)
    },
  })

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      reset()
      setServerError(null)
    }
  }

  const onSubmit = (values: CreateUserFormValues) => {
    setServerError(null)
    mutation.mutate(values)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button size="sm">
            <PlusIcon />
            New user
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New user</DialogTitle>
          <DialogDescription>
            Create a new agent account for the helpdesk.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input
                id="name"
                autoComplete="name"
                aria-invalid={!!errors.name}
                {...register('name')}
              />
              <FieldError errors={errors.name ? [errors.name] : undefined} />
            </Field>
            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              <FieldError errors={errors.email ? [errors.email] : undefined} />
            </Field>
            <Field data-invalid={!!errors.password}>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                aria-invalid={!!errors.password}
                {...register('password')}
              />
              <FieldError
                errors={errors.password ? [errors.password] : undefined}
              />
            </Field>
            {serverError && <FieldError>{serverError}</FieldError>}
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Creating…' : 'Create user'}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default CreateUserDialog
