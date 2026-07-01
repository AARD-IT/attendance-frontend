const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

const SHIFT_ASSIGNMENT_CACHE_KEY = 'shift-management-assignments-cache'
const SHIFT_ASSIGNMENT_CACHE_TTL_MS = 10 * 60 * 1000

function authHeader() {
  const token = localStorage.getItem('attendance-dashboard-token') || ''
  return { Authorization: `Bearer ${token}` }
}

function readCache() {
  try {
    const raw = sessionStorage.getItem(SHIFT_ASSIGNMENT_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { expiresAt: number; value: any[] }
    if (parsed.expiresAt < Date.now()) {
      sessionStorage.removeItem(SHIFT_ASSIGNMENT_CACHE_KEY)
      return null
    }
    return parsed.value
  } catch {
    return null
  }
}

function writeCache(value: any[]) {
  sessionStorage.setItem(SHIFT_ASSIGNMENT_CACHE_KEY, JSON.stringify({ expiresAt: Date.now() + SHIFT_ASSIGNMENT_CACHE_TTL_MS, value }))
}

export async function getShiftAssignments(options?: { forceRefresh?: boolean; employee_id?: string; active_only?: boolean }) {
  if (!options?.forceRefresh) {
    const cached = readCache()
    if (cached) return cached
  }

  const search = new URLSearchParams()
  if (options?.employee_id) search.set('employee_id', options.employee_id)
  if (options?.active_only) search.set('active_only', 'true')
  const query = search.toString() ? `?${search.toString()}` : ''

  const res = await fetch(`${API_BASE}/api/shift-assignments${query}`, { headers: { ...authHeader() } })
  if (!res.ok) throw new Error('Failed to fetch shift assignments')
  const data = await res.json()
  const assignments = Array.isArray(data) ? data : []
  writeCache(assignments)
  return assignments
}

export async function createShiftAssignment(payload: any) {
  const res = await fetch(`${API_BASE}/api/shift-assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || 'Failed to create shift assignment')
  }
  sessionStorage.removeItem(SHIFT_ASSIGNMENT_CACHE_KEY)
  return await res.json()
}

export async function updateShiftAssignment(id: string, payload: any) {
  const res = await fetch(`${API_BASE}/api/shift-assignments/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || 'Failed to update shift assignment')
  }
  sessionStorage.removeItem(SHIFT_ASSIGNMENT_CACHE_KEY)
  return await res.json()
}

export async function deleteShiftAssignment(id: string) {
  const res = await fetch(`${API_BASE}/api/shift-assignments/${id}`, { method: 'DELETE', headers: { ...authHeader() } })
  if (!res.ok) throw new Error('Failed to delete shift assignment')
  sessionStorage.removeItem(SHIFT_ASSIGNMENT_CACHE_KEY)
  return await res.json()
}

export async function deleteEmployeeShiftAssignments(employeeId: string) {
  const res = await fetch(`${API_BASE}/api/ceo/shift-assignments/employee/${employeeId}`, { method: 'DELETE', headers: { ...authHeader() } })
  if (!res.ok) throw new Error('Failed to delete employee shift assignments')
  sessionStorage.removeItem(SHIFT_ASSIGNMENT_CACHE_KEY)
  return await res.json()
}

export default {
  getShiftAssignments,
  createShiftAssignment,
  updateShiftAssignment,
  deleteShiftAssignment,
  deleteEmployeeShiftAssignments,
}
