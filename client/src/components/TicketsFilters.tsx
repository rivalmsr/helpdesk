import { Search, X } from 'lucide-react'
import {
  TICKET_STATUSES,
  TICKET_CATEGORIES,
  type TicketStatus,
  type TicketCategory,
} from 'core'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FilterSelect, type FilterOption } from '@/components/FilterSelect'
import { STATUS_LABEL } from '@/lib/ticketMeta'

// Short labels for the filter options (the table badges use the fuller labels
// in ticketMeta). Capitalizing the enum value keeps a single source of truth.
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// The `all` sentinel is a UI-only "no filter" value (not a domain enum member),
// so its literal key is fine; the enum options reference the `core` constants.
const STATUS_OPTIONS: FilterOption<TicketStatus>[] = [
  { value: 'all', label: 'All statuses' },
  ...TICKET_STATUSES.map((value) => ({ value, label: STATUS_LABEL[value] })),
]

const CATEGORY_OPTIONS: FilterOption<TicketCategory>[] = [
  { value: 'all', label: 'All categories' },
  ...TICKET_CATEGORIES.map((value) => ({ value, label: capitalize(value) })),
]

// The ticket list's filter toolbar: debounced search plus status/category
// dropdowns, and a Clear button shown once any filter is active. Purely
// controlled — the page owns the filter state and refetches off it.
export function TicketsFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  category,
  onCategoryChange,
  hasFilters,
  onClear,
}: {
  search: string
  onSearchChange: (value: string) => void
  status: TicketStatus | 'all'
  onStatusChange: (value: TicketStatus | 'all') => void
  category: TicketCategory | 'all'
  onCategoryChange: (value: TicketCategory | 'all') => void
  hasFilters: boolean
  onClear: () => void
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search subject or requester…"
          aria-label="Search tickets"
          className="pl-8"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <FilterSelect<TicketStatus>
        label="Filter by status"
        options={STATUS_OPTIONS}
        value={status}
        onChange={onStatusChange}
      />
      <FilterSelect<TicketCategory>
        label="Filter by category"
        options={CATEGORY_OPTIONS}
        value={category}
        onChange={onCategoryChange}
      />
      {hasFilters && (
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          <X className="size-4" />
          Clear
        </Button>
      )}
    </div>
  )
}
