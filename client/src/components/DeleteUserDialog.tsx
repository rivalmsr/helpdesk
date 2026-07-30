import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { getServerErrorMessage } from '@/lib/http'
import { Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

type DeletableUser = {
  id: string
  name: string
}

function DeleteUserDialog({ user }: { user: DeletableUser }) {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      await axios.delete(`/api/users/${user.id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setServerError(null)
      setOpen(false)
    },
    onError: (error) => {
      setServerError(getServerErrorMessage(error, 'Failed to delete user'))
    },
  })

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    // Clear any stale error each time the dialog opens or closes.
    setServerError(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm">
            <Trash2Icon />
            <span className="sr-only">Delete {user.name}</span>
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete user</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete {user.name}? They will lose access
            immediately.
          </DialogDescription>
        </DialogHeader>
        {serverError && <p className="text-sm text-destructive">{serverError}</p>}
        <DialogFooter>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DeleteUserDialog
