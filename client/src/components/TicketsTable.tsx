import { flexRender, type Table as TanstackTable } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
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
import type { Ticket } from '@/pages/TicketsPage'

// The ticket list table: sortable column headers (server-side sort, so clicking
// only toggles state + `aria-sort` and the page refetches) and a body that shows
// skeleton rows while `isPending`, otherwise a row per ticket. Driven entirely by
// the TanStack `table` instance the page owns.
export function TicketsTable({
  table,
  isPending,
}: {
  table: TanstackTable<Ticket>
  isPending: boolean
}) {
  return (
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
                      sorted ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                    <SortIcon className="size-3.5 shrink-0" aria-hidden="true" />
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
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
      </TableBody>
    </Table>
  )
}
