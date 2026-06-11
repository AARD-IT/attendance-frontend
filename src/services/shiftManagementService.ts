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

function fallbackAssignments() {
  try {
    return JSON.parse(localStorage.getItem('shift-management-assignments') || '[]')
  } catch {
    return []
  }
}

function persistAssignments(assignments: any[]) {
  try {
    const merged = Array.isArray(assignments) ? assignments : []
    localStorage.setItem('shift-management-assignments', JSON.stringify(merged))
  } catch {
    // Ignore persistence errors and keep the UI working with the in-memory data.
  }
}

export async function getShiftAssignments(options?: { forceRefresh?: boolean }) {
  if (!options?.forceRefresh) {
    const cached = readCache()
    if (cached) return cached
  }

  try {
    const res = await fetch(`${API_BASE}/api/ceo/shift-assignments`, { headers: { ...authHeader() } })
    if (!res.ok) throw new Error('Failed to fetch shift assignments')
    const data = await res.json()
    const assignments = Array.isArray(data) ? data : []
    writeCache(assignments)
    persistAssignments(assignments)
    return assignments
  } catch {
    return fallbackAssignments()
  }
}

export async function createShiftAssignment(payload: any) {
  try {
    const res = await fetch(`${API_BASE}/api/ceo/shift-assignments`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader() }, body: JSON.stringify(payload) })
    if (!res.ok) throw new Error('Failed to create shift assignment')
    const result = await res.json()
    const saved = fallbackAssignments().filter((item: any) => String(item.employee_id) !== String(payload.employee_id))
    saved.push({ ...payload, ...result })
    persistAssignments(saved)
    return result
  } catch {
    const saved = fallbackAssignments().filter((item: any) => String(item.employee_id) !== String(payload.employee_id))
    saved.push(payload)
    persistAssignments(saved)
    return payload
  }
}

export async function updateShiftAssignment(id: string, payload: any) {
  try {
    const res = await fetch(`${API_BASE}/api/ceo/shift-assignments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeader() }, body: JSON.stringify(payload) })
    if (!res.ok) throw new Error('Failed to update shift assignment')
    return await res.json()
  } catch {
    const saved = fallbackAssignments().filter((item: any) => String(item.id) !== String(id))
    saved.push({ ...payload, id })
    localStorage.setItem('shift-management-assignments', JSON.stringify(saved))
    return { ...payload, id }
  }
}

export async function deleteShiftAssignment(id: string) {
  try {
    const res = await fetch(`${API_BASE}/api/ceo/shift-assignments/${id}`, { method: 'DELETE', headers: { ...authHeader() } })
    if (!res.ok) throw new Error('Failed to delete shift assignment')
    return await res.json()
  } catch {
    const saved = fallbackAssignments().filter((item: any) => String(item.id) !== String(id))
    localStorage.setItem('shift-management-assignments', JSON.stringify(saved))
    return { deleted: true }
  }
}

export async function deleteEmployeeShiftAssignments(employeeId: string) {
  try {
    const res = await fetch(`${API_BASE}/api/ceo/shift-assignments/employee/${employeeId}`, { method: 'DELETE', headers: { ...authHeader() } })
    if (!res.ok) throw new Error('Failed to delete employee shift assignments')
    return await res.json()
  } catch {
    const saved = fallbackAssignments().filter((item: any) => String(item.employee_id) !== String(employeeId))
    localStorage.setItem('shift-management-assignments', JSON.stringify(saved))
    return { deleted: true }
  }
}

export default { getShiftAssignments, createShiftAssignment, updateShiftAssignment, deleteShiftAssignment, deleteEmployeeShiftAssignments }
