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
