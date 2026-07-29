import axios from 'axios'

/**
 * Extracts a user-facing error message from a failed request, preferring the
 * server's `{ error }` payload and falling back to `fallback` for non-Axios
 * errors or responses without a message.
 */
export function getServerErrorMessage(error: unknown, fallback: string): string {
  return axios.isAxiosError(error)
    ? (error.response?.data?.error ?? fallback)
    : fallback
}
