/**
 * ProtectedRoute Component
 * Wraps routes to ensure user is authenticated and has required role
 * Redirects to login if not authenticated
 * Shows access denied message if role doesn't match
 */

import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'CEO' | 'EMPLOYEE'
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const auth = useAuth()

  // Show loading state while checking authentication
  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm text-slate-700">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-700"></div>
            <span>Loading session...</span>
          </div>
        </div>
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (!auth.isAuthenticated()) {
    return <Navigate to="/login" replace />
  }

  // Check role if required
  if (requiredRole && auth.user?.role !== requiredRole) {
    // Show access denied message
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-lg rounded-3xl border border-rose-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="text-2xl">🚫</div>
            <h1 className="text-xl font-semibold text-slate-900">Access Denied</h1>
          </div>
          <p className="text-slate-600">
            You do not have permission to access this page. This page is only available for{' '}
            <span className="font-medium text-slate-900">{requiredRole}</span> users.
          </p>
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => window.history.back()}
              className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Go Back
            </button>
            <button
              onClick={() => (window.location.href = '/')}
              className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 transition-colors"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Render children if authenticated and role matches
  return <>{children}</>
}

