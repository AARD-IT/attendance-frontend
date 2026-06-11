/**
 * Login Page
 * Provides email/password login form
 * Routes users to their respective dashboards after successful login
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const result = await auth.login({ email, password })
      const destination = result.user.role === 'CEO' ? '/ceo/dashboard' : '/employee/dashboard'
      navigate(destination, { replace: true })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed. Please try again.'
      setError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">📊</div>
          <h1 className="text-3xl font-bold text-slate-900">Attendance Dashboard</h1>
          <p className="mt-2 text-slate-600">Secure sign-in for CEO and employee accounts</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Sign In</h2>
          <p className="text-sm text-slate-600 mb-6">Log in with your registered email and password</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 placeholder-slate-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 placeholder-slate-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:bg-white"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-3">
                <span className="text-lg">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !email || !password}
              className="w-full py-3 px-4 rounded-lg bg-indigo-600 text-white font-semibold transition hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="inline-block animate-spin">⏳</span>
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Secure authentication powered by Supabase and FastAPI
        </p>
      </div>
    </div>
  )
}
