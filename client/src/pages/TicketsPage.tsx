import { useEffect, useState } from 'react'
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
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  Search,
  X,
} from 'lucide-react'
import {
  TICKET_STATUS,
  TICKET_STATUSES,
  TICKET_CATEGORY,
  TICKET_CATEGORIES,
  TICKET_SORT_FIELD,
  TICKET_PAGE_SIZE,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

// The paginated envelope returned by `GET /api/tickets`.
type TicketsResponse = {
  tickets: Ticket[]
  total: number
  page: number
  pageSize: number
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

// Page-size choices for the "Rows per page" selector (TICKET_PAGE_SIZE is the default).
const PAGE_SIZE_OPTIONS = [10, 20, 50]

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

  const [pageSize, setPageSize] = useState<number>(TICKET_PAGE_SIZE)

  // 1-based page. Reset to the first page whenever the sort, a filter, or the
  // page size changes, so you never land on a now-out-of-range page.
  const [page, setPage] = useState(1)
  useEffect(() => {
    setPage(1)
  }, [sort, status, category, debouncedSearch, pageSize])

  const hasFilters =
    status !== 'all' || category !== 'all' || search.trim() !== ''

  const clearFilters = () => {
    setStatus('all')
    setCategory('all')
    setSearch('')
  }

  const { data, isPending, isError } = useQuery({
    // Sort + filters + page + pageSize are part of the key so any change refetches.
    queryKey: [
      'tickets',
      sort,
      { status, category, q: debouncedSearch },
      page,
      pageSize,
    ],
    queryFn: async () => {
      const res = await axios.get<TicketsResponse>('/api/tickets', {
        params: {
          sort: sort.id,
          order: sort.desc ? 'desc' : 'asc',
          // Omit params at their defaults, so the default request stays sort-only.
          ...(status !== 'all' ? { status } : {}),
          ...(category !== 'all' ? { category } : {}),
          ...(debouncedSearch ? { q: debouncedSearch } : {}),
          ...(page > 1 ? { page } : {}),
          ...(pageSize !== TICKET_PAGE_SIZE ? { pageSize } : {}),
        },
      })
      return res.data
    },
    // Keep the current rows visible while the re-sorted/filtered/paged load runs.
    placeholderData: keepPreviousData,
    retry: 3,
  })

  const tickets = data?.tickets ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  const table = useReactTable({
    data: tickets,
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
          {!isError && !isPending && tickets.length === 0 && (
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
          {!isError && total > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Rows per page
                  </span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(next) => {
                      if (next) setPageSize(Number(next))
                    }}
                  >
                    <SelectTrigger
                      size="sm"
                      className="w-18"
                      aria-label="Rows per page"
                    >
                      <SelectValue>{(v: string | null) => v}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-sm text-muted-foreground">
                  Page {page} of {pageCount} · {total} total
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="First page"
                  disabled={page <= 1}
                  onClick={() => setPage(1)}
                >
                  <ChevronsLeft className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="size-4" />
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Last page"
                  disabled={page >= pageCount}
                  onClick={() => setPage(pageCount)}
                >
                  <ChevronsRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default TicketsPage
