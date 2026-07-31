import type { ReactElement, ReactNode } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Renders `ui` wrapped in a fresh {@link QueryClientProvider}.
 *
 * `retryDelay: 0` strips the backoff between retries so components that set
 * their own `retry` count (e.g. UsersPage's `retry: 3`) reach their error
 * state without slowing the test down.
 */
export function renderWithQueryClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0 } },
  })

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }

  return render(ui, { wrapper: Wrapper })
}

/**
 * Like {@link renderWithQueryClient}, but also wraps the tree in a
 * {@link MemoryRouter} — for components that use `<Link>` / router hooks
 * (`useParams`, etc.). Pass `initialEntries` to control the starting location
 * (e.g. `['/tickets/1']` so `useParams` sees an `id`).
 */
export function renderWithProviders(
  ui: ReactElement,
  { initialEntries = ['/'] }: { initialEntries?: string[] } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0 } },
  })

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </QueryClientProvider>
    )
  }

  return render(ui, { wrapper: Wrapper })
}
