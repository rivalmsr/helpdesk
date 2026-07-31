import { useEffect, useState } from 'react'

/**
 * Returns `value` delayed by `delayMs` — the returned value only updates once the
 * input has stopped changing for that long. Used to avoid firing a request on
 * every keystroke of a search box (see TicketsPage's filter query).
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
