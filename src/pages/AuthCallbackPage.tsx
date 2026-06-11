import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = () => {
      const search = window.location.hash.startsWith('#')
        ? window.location.hash.substring(1)
        : window.location.search.substring(1)
      const params = new URLSearchParams(search)

      const errorCode = params.get('error_code')
      const errorDescription = params.get('error_description')
      const accessToken = params.get('access_token')

      if (errorCode) {
        setError(`Error: ${errorDescription || errorCode}`)
        setTimeout(() => navigate('/login', { replace: true }), 3000)
        return
      }

      if (accessToken) {
        localStorage.setItem('attendance-dashboard-token', accessToken)
        navigate('/login', { replace: true })
        return
      }

      setError('Authentication callback did not return a valid token.')
      setTimeout(() => navigate('/login', { replace: true }), 3000)
    }

    handleCallback()
  }, [navigate])

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center px-6 py-8 rounded-3xl border border-slate-200 bg-white shadow-sm">
        {error ? (
          <>
            <div className="text-4xl mb-4">⚠️</div>
            <p className="text-red-600 font-semibold">{error}</p>
            <p className="mt-3 text-sm text-slate-500">Redirecting to login...</p>
          </>
        ) : (
          <>
            <div className="inline-block animate-spin mb-4">⏳</div>
            <p className="text-slate-600">Processing authentication callback...</p>
          </>
        )}
      </div>
    </div>
  )
}
