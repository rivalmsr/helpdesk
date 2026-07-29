import type { FormEventHandler } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import type { UpdateUserInput } from 'core'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { DialogFooter } from '@/components/ui/dialog'

// Field names come from the shared core schema, so this form stays in sync when
// the schema changes. Register/errors stay structurally loose (below) on
// purpose — binding them to `UseFormRegister<SchemaType>` reintroduces the
// field-optionality assignability error between the create and edit dialogs.
type FieldName = keyof UpdateUserInput

/**
 * Minimal shape of a single RHF field error that this form reads (just the
 * message). Keeps the props decoupled from the exact schema type so both the
 * create and edit dialogs can pass their `register` / `errors` directly,
 * regardless of each field's optionality in their form-values type.
 */
type FieldMessage = { message?: string }

type UserFormProps = {
  onSubmit: FormEventHandler<HTMLFormElement>
  register: (name: FieldName) => UseFormRegisterReturn
  errors: Partial<Record<FieldName, FieldMessage>>
  serverError: string | null
  isPending: boolean
  submitLabel: string
  pendingLabel: string
  passwordLabel: string
  passwordPlaceholder?: string
}

/**
 * Presentational name / email / password form shared by CreateUserDialog and
 * EditUserDialog. The owning dialog keeps its own `useForm`, mutation, schema,
 * and submit handling and passes the pieces this form renders.
 */
function UserForm({
  onSubmit,
  register,
  errors,
  serverError,
  isPending,
  submitLabel,
  pendingLabel,
  passwordLabel,
  passwordPlaceholder,
}: UserFormProps) {
  return (
    <form onSubmit={onSubmit} noValidate>
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
          <FieldLabel htmlFor="password">{passwordLabel}</FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder={passwordPlaceholder}
            aria-invalid={!!errors.password}
            {...register('password')}
          />
          <FieldError
            errors={errors.password ? [errors.password] : undefined}
          />
        </Field>
        {serverError && <FieldError>{serverError}</FieldError>}
        <DialogFooter>
          <Button type="submit" disabled={isPending}>
            {isPending ? pendingLabel : submitLabel}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

export default UserForm
