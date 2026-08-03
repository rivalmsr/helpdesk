import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  TicketVolumeChart,
  type DailyVolume,
} from '@/components/TicketVolumeChart'
import { formatDuration } from '@/lib/format'

// The KPI payload returned by `GET /api/stats`. `avgResolutionSeconds` is null
// when no tickets have been resolved yet (nothing to average); `dailyVolume` is
// a zero-filled series of tickets created per day over the last 30 days.
type StatsResponse = {
  total: number
  open: number
  aiResolved: number
  avgResolutionSeconds: number | null
  dailyVolume: DailyVolume[]
}

// One KPI tile: a sentence-case label over a large, semibold value (stat-tile
// contract). `value` is a node so callers can render "—" / formatted strings.
function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: ReactNode
  hint?: string
}) {
  return (
    <Card size="sm">
      <CardContent>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

// A placeholder tile shown while the stats request is pending. Intentionally
// renders no label text (only skeleton blocks) so a tile's real label appears
// only once its value is available.
function StatCardSkeleton() {
  return (
    <Card size="sm">
      <CardContent>
        <Skeleton className="h-5 w-24" />
        <Skeleton className="mt-2 h-9 w-20" />
      </CardContent>
    </Card>
  )
}

const TILE_LABELS = [
  'Total tickets',
  'Open tickets',
  'Resolved by AI',
  'AI resolution rate',
  'Avg. resolution time',
] as const

function DashboardPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const res = await axios.get<StatsResponse>('/api/stats')
      return res.data
    },
    retry: 3,
  })

  // Percentage of all tickets the AI resolved from the knowledge base.
  const aiResolvedPct =
    data && data.total > 0
      ? Math.round((data.aiResolved / data.total) * 100)
      : 0

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={1}>
            Dashboard
          </CardTitle>
          <CardDescription>
            An overview of ticket volume and AI resolution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isError && (
            <p className="text-sm text-destructive">Failed to load dashboard</p>
          )}
          {!isError && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {isPending || !data ? (
                TILE_LABELS.map((label) => <StatCardSkeleton key={label} />)
              ) : (
                <>
                  <StatCard label={TILE_LABELS[0]} value={data.total} />
                  <StatCard label={TILE_LABELS[1]} value={data.open} />
                  <StatCard label={TILE_LABELS[2]} value={data.aiResolved} />
                  <StatCard
                    label={TILE_LABELS[3]}
                    value={`${aiResolvedPct}%`}
                    hint={`${data.aiResolved} of ${data.total} tickets`}
                  />
                  <StatCard
                    label={TILE_LABELS[4]}
                    value={formatDuration(data.avgResolutionSeconds)}
                    hint="Avg. of last update − created"
                  />
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Tickets per day</CardTitle>
          <CardDescription>Created over the last 30 days.</CardDescription>
        </CardHeader>
        <CardContent>
          {isError && (
            <p className="text-sm text-destructive">Failed to load chart</p>
          )}
          {!isError &&
            (isPending || !data ? (
              <Skeleton className="h-[220px] w-full" />
            ) : (
              <TicketVolumeChart data={data.dailyVolume} />
            ))}
        </CardContent>
      </Card>
    </div>
  )
}

export default DashboardPage
