// Shared, locale-aware formatting helpers so every page renders values the same
// way. Keep the single `Intl` instance here rather than re-declaring it per page.

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

/** Formats a date (or date string/timestamp) as e.g. "Jan 15, 2026". */
export function formatDate(value: string | number | Date): string {
  return dateFormatter.format(new Date(value))
}

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

/** Formats a date/time as e.g. "Jan 15, 2026, 3:04 PM" (for message timestamps). */
export function formatDateTime(value: string | number | Date): string {
  return dateTimeFormatter.format(new Date(value))
}

const monthDayFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
})

/**
 * Formats a plain `YYYY-MM-DD` day string as e.g. "Aug 3", parsing it as a local
 * date so it never shifts across a timezone boundary (unlike `new Date('YYYY-MM-DD')`,
 * which is UTC midnight). Used for the daily-volume chart's axis and tooltips.
 */
export function formatMonthDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return monthDayFormatter.format(new Date(y, m - 1, d))
}

/**
 * Formats a duration in seconds as a compact human string, showing the two most
 * significant units — e.g. "45m", "2h 15m", "3d 4h". `null` (no data, e.g. no
 * resolved tickets to average) renders as an em dash; sub-minute durations round
 * to "< 1m". Used by the dashboard's average-resolution-time tile.
 */
export function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—'
  if (seconds < 60) return '< 1m'

  const totalMinutes = Math.floor(seconds / 60)
  const minutes = totalMinutes % 60
  const totalHours = Math.floor(totalMinutes / 60)
  const hours = totalHours % 24
  const days = Math.floor(totalHours / 24)

  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  // Keep only the two most significant units (e.g. "3d 4h", not "3d 4h 12m").
  return parts.slice(0, 2).join(' ')
}
