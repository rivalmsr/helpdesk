import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from '@tanstack/react-table'
import axios from 'axios'
import {
  TICKET_SORT_FIELD,
  TICKET_PAGE_SIZE,
  type TicketStatus,
  type TicketCategory,
} from 'core'
import { StatusBadge, CategoryBadge } from '@/components/TicketBadge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Pagination } from '@/components/Pagination'
import { TicketsFilters } from '@/components/TicketsFilters'
import { TicketsTable } from '@/components/TicketsTable'
import { formatDate } from '@/lib/format'
import { useDebouncedValue } from '@/lib/useDebouncedValue'

// Let column defs carry an alignment hint used by the header/cell renderers.
declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: 'right'
  }
}

// One row in the ticket list (`GET /api/tickets`). Exported for `TicketsTable`,
// which renders the rows off the TanStack table instance.
export type Ticket = {
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
    cell: (info) => (
      <Link
        to={`/tickets/${info.row.original.id}`}
        className="font-medium hover:underline"
      >
        {info.getValue()}
      </Link>
    ),
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
      return <StatusBadge status={status} />
    },
  }),
  columnHelper.accessor('category', {
    id: TICKET_SORT_FIELD.category,
    header: 'Category',
    cell: (info) => (
      <CategoryBadge category={info.getValue<TicketCategory>()} />
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
  // Reveal the AI-owned tickets (new/processing/ai_resolved) hidden by default.
  const [showAiHandled, setShowAiHandled] = useState(false)

  const [pageSize, setPageSize] = useState<number>(TICKET_PAGE_SIZE)

  // 1-based page. Reset to the first page whenever the sort, a filter, the
  // AI-handled toggle, or the page size changes, so you never land on a
  // now-out-of-range page.
  const [page, setPage] = useState(1)
  useEffect(() => {
    setPage(1)
  }, [sort, status, category, debouncedSearch, showAiHandled, pageSize])

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
      { status, category, q: debouncedSearch, showAiHandled },
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
          ...(showAiHandled ? { includeAiHandled: true } : {}),
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
            <TicketsFilters
              search={search}
              onSearchChange={setSearch}
              status={status}
              onStatusChange={setStatus}
              category={category}
              onCategoryChange={setCategory}
              showAiHandled={showAiHandled}
              onShowAiHandledChange={setShowAiHandled}
              hasFilters={hasFilters}
              onClear={clearFilters}
            />
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
            <TicketsTable table={table} isPending={isPending} />
          )}
          {!isError && total > 0 && (
            <Pagination
              page={page}
              pageCount={pageCount}
              total={total}
              pageSize={pageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default TicketsPage
