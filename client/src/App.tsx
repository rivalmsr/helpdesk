import { useState } from 'react'

type HealthResponse = {
  status: string
}

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const checkHealth = async () => {
    setError(null)
    try {
      const res = await fetch('/api/health')
      if (!res.ok) throw new Error(`Request failed: ${res.status}`)
      const data: HealthResponse = await res.json()
      setHealth(data)
    } catch (err) {
      setHealth(null)
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  return (
    <main className="mx-auto max-w-md p-4 text-center">
      <h1 className="text-2xl font-semibold">Helpdesk</h1>
      <button
        type="button"
        onClick={checkHealth}
        className="mt-4 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Check API health
      </button>
      {health && (
        <pre className="mt-4 rounded bg-gray-100 p-4 text-left">
          {JSON.stringify(health, null, 2)}
        </pre>
      )}
      {error && <p className="mt-4 text-red-600">{error}</p>}
    </main>
  )
}

export default App
