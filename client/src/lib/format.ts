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
