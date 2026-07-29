import { useState } from 'react'
import { Button } from '@/components/ui/button'

type HealthResponse = {
  status: string
}

function HomePage() {
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
    <div className="text-center">
      <h1 className="text-2xl font-semibold">Helpdesk</h1>
      <Button type="button" onClick={checkHealth} className="mt-4">
        Check API health
      </Button>
      {health && (
        <pre className="mt-4 rounded bg-gray-100 p-4 text-left">
          {JSON.stringify(health, null, 2)}
        </pre>
      )}
      {error && <p className="mt-4 text-red-600">{error}</p>}
    </div>
  )
}

export default HomePage
