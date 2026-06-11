/**
 * Auth Context - Manages authentication state globally
 * Provides current user, JWT token, and session actions.
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { AuthResponse, LoginPayload, RegisterPayload, User } from '../types/auth'

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const STORAGE_TOKEN_KEY = 'attendance-dashboard-token'
const STORAGE_USER_KEY = 'attendance-dashboard-user'

interface AuthContextValue {
  user: User | null
  token: string | null
  loading: boolean
  error: string | null
  login: (payload: LoginPayload) => Promise<AuthResponse>
  register: (payload: RegisterPayload) => Promise<AuthResponse>
  logout: () => Promise<void>
  isAuthenticated: () => boolean
  isCEO: () => boolean
  isEmployee: () => boolean
}

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function fetchWithAuth(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem(STORAGE_TOKEN_KEY)
  const headers = {
    'Content-Type': 'application/json',
    ...(init.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  return fetch(input, {
    ...init,
    headers,
  })
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem(STORAGE_USER_KEY)
    if (!stored) return null

    try {
      return JSON.parse(stored) as User
    } catch {
      localStorage.removeItem(STORAGE_USER_KEY)
      return null
    }
  })
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_TOKEN_KEY))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initialize = async () => {
      const storedToken = localStorage.getItem(STORAGE_TOKEN_KEY)
      if (!storedToken) {
        setLoading(false)
        return
      }

      try {
        const response = await fetch(`${apiUrl}/api/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        })

        if (!response.ok) {
          throw new Error('Session invalid or expired')
        }

        const profile = await response.json()
        setUser(profile)
        setToken(storedToken)
        setError(null)
      } catch (err) {
        setUser(null)
        setToken(null)
        setError(err instanceof Error ? err.message : 'Authentication failed')
        localStorage.removeItem(STORAGE_TOKEN_KEY)
        localStorage.removeItem(STORAGE_USER_KEY)
      } finally {
        setLoading(false)
      }
    }

    initialize()
  }, [])

  const login = async ({ email, password }: LoginPayload): Promise<AuthResponse> => {
    try {
      setError(null)
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body?.detail || 'Unable to sign in. Please check your credentials.')
      }

      const result = (await response.json()) as AuthResponse
      setUser(result.user)
      setToken(result.access_token)
      localStorage.setItem(STORAGE_TOKEN_KEY, result.access_token)
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(result.user))
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed'
      setError(errorMessage)
      throw err
    }
  }

  const register = async ({ email, password, full_name, role }: RegisterPayload): Promise<AuthResponse> => {
    try {
      setError(null)
      const response = await fetch(`${apiUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name, role }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body?.detail || 'Unable to create account. Please try again.')
      }

      const result = (await response.json()) as AuthResponse
      if (result.access_token) {
        setUser(result.user)
        setToken(result.access_token)
        localStorage.setItem(STORAGE_TOKEN_KEY, result.access_token)
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(result.user))
      }
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Signup failed'
      setError(errorMessage)
      throw err
    }
  }

  const logout = async () => {
    try {
      if (token) {
        await fetchWithAuth(`${apiUrl}/api/auth/logout`, { method: 'POST' }).catch(() => null)
      }
    } finally {
      setUser(null)
      setToken(null)
      setError(null)
      localStorage.removeItem(STORAGE_TOKEN_KEY)
      localStorage.removeItem(STORAGE_USER_KEY)
    }
  }

  const isAuthenticated = () => Boolean(user && token)
  const isCEO = () => user?.role === 'CEO'
  const isEmployee = () => user?.role === 'EMPLOYEE'

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      error,
      login,
      register,
      logout,
      isAuthenticated,
      isCEO,
      isEmployee,
    }),
    [user, token, loading, error]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}

