import { Skeleton } from '@/components/ui/skeleton'

// Loading placeholder for the ticket detail header while the ticket query is
// pending — mirrors the header's shape (title, metadata line, control row) so
// the layout doesn't shift once the real data arrives.
export function TicketDetailSkeleton() {
  return (
    <div className="border-b pb-5">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="mt-3 h-4 w-96" />
      <div className="mt-4 flex flex-wrap gap-6">
        <Skeleton className="h-13 w-40" />
        <Skeleton className="h-13 w-40" />
        <Skeleton className="h-13 w-40" />
      </div>
    </div>
  )
}
