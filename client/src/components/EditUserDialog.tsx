import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { updateUserSchema, type UpdateUserInput } from 'core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { getServerErrorMessage } from '@/lib/http'
import { PencilIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import UserForm from '@/components/UserForm'

type EditableUser = {
  id: string
  name: string
  email: string
}

type EditUserFormValues = UpdateUserInput

function EditUserDialog({ user }: { user: EditableUser }) {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const defaultValues: EditUserFormValues = {
    name: user.name,
    email: user.email,
    password: '',
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditUserFormValues>({
    resolver: zodResolver(updateUserSchema),
    defaultValues,
  })

  const mutation = useMutation({
    mutationFn: async (values: EditUserFormValues) => {
      const res = await axios.patch(`/api/users/${user.id}`, values)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setServerError(null)
      setOpen(false)
    },
    onError: (error) => {
      setServerError(getServerErrorMessage(error, 'Failed to update user'))
    },
  })

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    // Repopulate the form with the user's current values each time it opens,
    // and clear any stale error/input when it closes.
    reset(defaultValues)
    setServerError(null)
  }

  const onSubmit = (values: EditUserFormValues) => {
    setServerError(null)
    mutation.mutate(values)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm">
            <PencilIcon />
            <span className="sr-only">Edit {user.name}</span>
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>Update this user's details.</DialogDescription>
        </DialogHeader>
        <UserForm
          onSubmit={handleSubmit(onSubmit)}
          register={register}
          errors={errors}
          serverError={serverError}
          isPending={mutation.isPending}
          submitLabel="Save changes"
          pendingLabel="Saving…"
          passwordLabel="New password"
          passwordPlaceholder="Leave blank to keep current password"
        />
      </DialogContent>
    </Dialog>
  )
}

export default EditUserDialog
