const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

type PaginatedResult<T> = {
  total: number
  page: number
  records: T[]
}

function authHeader() {
  const token = localStorage.getItem('attendance-dashboard-token') || ''
  return { Authorization: `Bearer ${token}` }
}

export async function getAttendance(page = 1, limit = 20, employeeId?: string, startDate?: string, endDate?: string) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('limit', String(limit))
  if (employeeId) params.set('employee_id', employeeId)
  if (startDate) params.set('start_date', startDate)
  if (endDate) params.set('end_date', endDate)

  const res = await fetch(`${API_BASE}/api/attendance?${params.toString()}`, { headers: { ...authHeader() } })
  if (!res.ok) throw new Error('Failed to fetch attendance')
  const data: PaginatedResult<any> = await res.json()
  return data
}

export async function getMyAttendance() {
  const res = await fetch(`${API_BASE}/api/attendance/me`, { headers: { ...authHeader() } })
  if (!res.ok) throw new Error('Failed to fetch my attendance')
  return await res.json()
}

export async function getAttendanceSummary() {
  const res = await fetch(`${API_BASE}/api/attendance/summary`, { headers: { ...authHeader() } })
  if (!res.ok) throw new Error('Failed to fetch attendance summary')
  return await res.json()
}

// Admin APIs (CEO only)
export async function createAttendance(payload: any) {
  const res = await fetch(`${API_BASE}/api/attendance`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader() }, body: JSON.stringify(payload) })
  if (!res.ok) throw new Error('Failed to create attendance')
  return await res.json()
}

export async function updateAttendance(id: string, payload: any) {
  const res = await fetch(`${API_BASE}/api/attendance/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeader() }, body: JSON.stringify(payload) })
  if (!res.ok) throw new Error('Failed to update attendance')
  return await res.json()
}

export async function deleteAttendance(id: string) {
  const res = await fetch(`${API_BASE}/api/attendance/${id}`, { method: 'DELETE', headers: { ...authHeader() } })
  if (!res.ok) throw new Error('Failed to delete attendance')
  return await res.json()
}

export default { getAttendance, getMyAttendance, getAttendanceSummary, createAttendance, updateAttendance, deleteAttendance }
