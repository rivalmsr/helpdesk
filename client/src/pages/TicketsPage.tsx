import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from '@tanstack/react-table'
import axios from 'axios'
import { ArrowDown, ArrowUp, ChevronsUpDown, Search, X } from 'lucide-react'
import {
  TICKET_STATUS,
  TICKET_STATUSES,
  TICKET_CATEGORY,
  TICKET_CATEGORIES,
  TICKET_SORT_FIELD,
  type TicketStatus,
  type TicketCategory,
} from 'core'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FilterSelect, type FilterOption } from '@/components/FilterSelect'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import { useDebouncedValue } from '@/lib/useDebouncedValue'

// Let column defs carry an alignment hint used by the header/cell renderers.
declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: 'right'
  }
}

type Ticket = {
  id: string
  subject: string
  requesterEmail: string
  status: TicketStatus
  category: TicketCategory
  createdAt: string
  updatedAt: string
  _count: { messages: number }
}

// Friendly, human-readable labels for the enum values (see project-scope.md).
// Keys reference the `core` constants (the single source of truth) rather than
// bare strings, so these maps track the enum instead of duplicating it.
const STATUS_LABEL: Record<TicketStatus, string> = {
  [TICKET_STATUS.open]: 'Open',
  [TICKET_STATUS.resolved]: 'Resolved',
  [TICKET_STATUS.closed]: 'Closed',
}

const STATUS_VARIANT: Record<TicketStatus, 'default' | 'secondary' | 'outline'> =
{
  [TICKET_STATUS.open]: 'default',
  [TICKET_STATUS.resolved]: 'secondary',
  [TICKET_STATUS.closed]: 'outline',
}

const CATEGORY_LABEL: Record<TicketCategory, string> = {
  [TICKET_CATEGORY.general]: 'General Question',
  [TICKET_CATEGORY.technical]: 'Technical Question',
  [TICKET_CATEGORY.refund]: 'Refund Request',
}

// Short labels for the filter options (the table badges use the fuller labels
// above). Capitalizing the enum value keeps a single source of truth.
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

const columnHelper = createColumnHelper<Ticket>()

// Column ids equal the `core` sort-field names so the sort state maps straight
// to the `?sort=` query param the server understands (see TICKET_SORT_FIELD).
// `meta.align` right-aligns the numeric message-count column.
const columns: ColumnDef<Ticket, any>[] = [
  columnHelper.accessor('subject', {
    id: TICKET_SORT_FIELD.subject,
    header: 'Subject',
    cell: (info) => <span className="font-medium">{info.getValue()}</span>,
  }),
  columnHelper.accessor('requesterEmail', {
    id: TICKET_SORT_FIELD.requesterEmail,
    header: 'Requester',
    cell: (info) => (
      <span className="text-muted-foreground">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor('status', {
    id: TICKET_SORT_FIELD.status,
    header: 'Status',
    cell: (info) => {
      const status = info.getValue<TicketStatus>()
      return (
        <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
      )
    },
  }),
  columnHelper.accessor('category', {
    id: TICKET_SORT_FIELD.category,
    header: 'Category',
    cell: (info) => (
      <Badge variant="outline">
        {CATEGORY_LABEL[info.getValue<TicketCategory>()]}
      </Badge>
    ),
  }),
  columnHelper.accessor((row) => row._count.messages, {
    id: TICKET_SORT_FIELD.messages,
    header: 'Messages',
    meta: { align: 'right' },
    cell: (info) => (
      <span className="tabular-nums text-muted-foreground">
        {info.getValue()}
      </span>
    ),
  }),
  columnHelper.accessor('createdAt', {
    id: TICKET_SORT_FIELD.createdAt,
    header: 'Created',
    cell: (info) => (
      <span className="text-muted-foreground">{formatDate(info.getValue())}</span>
    ),
  }),
]

function TicketsPage() {
  // Single-column sort, defaulting to newest-first (the page's original order).
  const [sorting, setSorting] = useState<SortingState>([
    { id: TICKET_SORT_FIELD.createdAt, desc: true },
  ])
  // `enableSortingRemoval: false` keeps `sorting` non-empty, so `sort` is always set.
  const sort = sorting[0]

  // Server-side filters (each defaults to "no filter"). Debounce the search so a
  // request isn't fired on every keystroke.
  const [status, setStatus] = useState<TicketStatus | 'all'>('all')
  const [category, setCategory] = useState<TicketCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim(), 300)

  const hasFilters =
    status !== 'all' || category !== 'all' || search.trim() !== ''

  const clearFilters = () => {
    setStatus('all')
    setCategory('all')
    setSearch('')
  }

  const {
    data: tickets,
    isPending,
    isError,
  } = useQuery({
    // Sort + filters are part of the key so any change refetches from the server.
    queryKey: ['tickets', sort, { status, category, q: debouncedSearch }],
    queryFn: async () => {
      const res = await axios.get<Ticket[]>('/api/tickets', {
        params: {
          sort: sort.id,
          order: sort.desc ? 'desc' : 'asc',
          // Omit filters that are unset, so the default request stays sort-only.
          ...(status !== 'all' ? { status } : {}),
          ...(category !== 'all' ? { category } : {}),
          ...(debouncedSearch ? { q: debouncedSearch } : {}),
        },
      })
      return res.data
    },
    // Keep the current rows visible while the re-sorted/filtered page loads.
    placeholderData: keepPreviousData,
    retry: 3,
  })

  const table = useReactTable({
    data: tickets ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    // Server-side sorting: TanStack only tracks state and asks us to refetch;
    // it must NOT reorder rows itself (no getSortedRowModel).
    manualSorting: true,
    enableSortingRemoval: false,
    enableMultiSort: false,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={1}>
            Tickets
          </CardTitle>
          <CardDescription>
            Support tickets created from incoming email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isError && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search subject or requester…"
                  aria-label="Search tickets"
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <FilterSelect<TicketStatus>
                label="Filter by status"
                options={STATUS_OPTIONS}
                value={status}
                onChange={setStatus}
              />
              <FilterSelect<TicketCategory>
                label="Filter by category"
                options={CATEGORY_OPTIONS}
                value={category}
                onChange={setCategory}
              />
              {hasFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                >
                  <X className="size-4" />
                  Clear
                </Button>
              )}
            </div>
          )}
          {isError && (
            <p className="text-sm text-destructive">Failed to load tickets</p>
          )}
          {!isError && tickets && tickets.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {hasFilters
                ? 'No tickets match your filters.'
                : 'No tickets yet.'}
            </p>
          )}
          {!isError && (isPending || tickets.length > 0) && (
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const sorted = header.column.getIsSorted()
                      const align = header.column.columnDef.meta?.align
                      const SortIcon =
                        sorted === 'asc'
                          ? ArrowUp
                          : sorted === 'desc'
                            ? ArrowDown
                            : ChevronsUpDown
                      return (
                        <TableHead
                          key={header.id}
                          aria-sort={
                            sorted === 'asc'
                              ? 'ascending'
                              : sorted === 'desc'
                                ? 'descending'
                                : 'none'
                          }
                          className={align === 'right' ? 'text-right' : undefined}
                        >
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className={cn(
                              'inline-flex items-center gap-1 select-none hover:text-foreground',
                              align === 'right' && 'flex-row-reverse',
                              sorted
                                ? 'text-foreground'
                                : 'text-muted-foreground',
                            )}
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                            <SortIcon
                              className="size-3.5 shrink-0"
                              aria-hidden="true"
                            />
                          </button>
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {isPending
                  ? Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-48" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-40" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-16 rounded-4xl" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-28 rounded-4xl" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="ml-auto h-4 w-6" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                    </TableRow>
                  ))
                  : table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={
                            cell.column.columnDef.meta?.align === 'right'
                              ? 'text-right'
                              : undefined
                          }
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default TicketsPage
