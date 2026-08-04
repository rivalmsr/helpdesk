import type { TicketStatus, TicketCategory } from 'core'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  STATUS_LABEL,
  STATUS_BADGE_CLASS,
  STATUS_DOT_CLASS,
  CATEGORY_LABEL,
  CATEGORY_BADGE_CLASS,
  CATEGORY_DOT_CLASS,
} from '@/lib/ticketMeta'

// The app's signature element: a soft tinted pill with a leading solid dot,
// used identically wherever a ticket's status or category is *displayed* (the
// list, the detail header) so the whole app shares one scannable status
// language. Colors come from the single-source-of-truth maps in ticketMeta.
function TicketBadge({
  label,
  badgeClass,
  dotClass,
  className,
}: {
  label: string
  badgeClass: string
  dotClass: string
  className?: string
}) {
  return (
    <Badge variant="secondary" className={cn(badgeClass, className)}>
      <span className={cn('size-1.5 rounded-full', dotClass)} aria-hidden />
      {label}
    </Badge>
  )
}

export function StatusBadge({
  status,
  className,
}: {
  status: TicketStatus
  className?: string
}) {
  return (
    <TicketBadge
      label={STATUS_LABEL[status]}
      badgeClass={STATUS_BADGE_CLASS[status]}
      dotClass={STATUS_DOT_CLASS[status]}
      className={className}
    />
  )
}

export function CategoryBadge({
  category,
  className,
}: {
  category: TicketCategory
  className?: string
}) {
  return (
    <TicketBadge
      label={CATEGORY_LABEL[category]}
      badgeClass={CATEGORY_BADGE_CLASS[category]}
      dotClass={CATEGORY_DOT_CLASS[category]}
      className={className}
    />
  )
}
