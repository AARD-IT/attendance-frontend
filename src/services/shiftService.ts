const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

export interface Shift {
  id: string
  shift_name: string
  start_time: string
  end_time: string
  grace_time_minutes: number
  minimum_working_hours: number
  login_deviation_minutes: number
  logout_deviation_minutes: number
  status: boolean
  created_by?: string
  created_at?: string
  updated_at?: string
}

export interface ShiftPayload {
  shift_name: string
  start_time: string
  end_time: string
  grace_time_minutes?: number
  minimum_working_hours?: number
  login_deviation_minutes?: number
  logout_deviation_minutes?: number
  status?: boolean
}

function authHeader() {
  const token = localStorage.getItem('attendance-dashboard-token') || ''
  return { Authorization: `Bearer ${token}` }
}

export function formatTime(value: string) {
  const text = String(value || '').slice(0, 5)
  const [hours, minutes] = text.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 || 12
  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`
}

export function computeAllowedLogin(shift: Shift) {
  const [h, m] = String(shift.start_time).slice(0, 5).split(':').map(Number)
  const total = h * 60 + m + Number(shift.grace_time_minutes || 0)
  const hours = Math.floor(total / 60) % 24
  const mins = total % 60
  return formatTime(`${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`)
}

export function computeMinimumLogout(shift: Shift) {
  const [h, m] = String(shift.end_time).slice(0, 5).split(':').map(Number)
  const total = Math.max(0, h * 60 + m - Number(shift.logout_deviation_minutes || 0))
  const hours = Math.floor(total / 60) % 24
  const mins = total % 60
  return formatTime(`${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`)
}

export async function listShifts(activeOnly = false): Promise<Shift[]> {
  const query = activeOnly ? '?active_only=true' : ''
  const res = await fetch(`${API_BASE}/api/shifts${query}`, { headers: { ...authHeader() } })
  if (!res.ok) throw new Error('Failed to fetch shifts')
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function createShift(payload: ShiftPayload): Promise<Shift> {
  const res = await fetch(`${API_BASE}/api/shifts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(typeof body.detail === 'string' ? body.detail : 'Failed to create shift')
  }
  return await res.json()
}

export async function updateShift(id: string, payload: Partial<ShiftPayload>): Promise<Shift> {
  const res = await fetch(`${API_BASE}/api/shifts/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(typeof body.detail === 'string' ? body.detail : 'Failed to update shift')
  }
  return await res.json()
}

export async function deleteShift(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/shifts/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { ...authHeader() } })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(typeof body.detail === 'string' ? body.detail : 'Failed to delete shift')
  }
}

export async function getShiftHistory(params?: {
  employee_id?: string
  shift_id?: string
  from_date?: string
  to_date?: string
}) {
  const search = new URLSearchParams()
  if (params?.employee_id) search.set('employee_id', params.employee_id)
  if (params?.shift_id) search.set('shift_id', params.shift_id)
  if (params?.from_date) search.set('from_date', params.from_date)
  if (params?.to_date) search.set('to_date', params.to_date)
  const query = search.toString() ? `?${search.toString()}` : ''
  const res = await fetch(`${API_BASE}/api/shift-history${query}`, { headers: { ...authHeader() } })
  if (!res.ok) throw new Error('Failed to fetch shift history')
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export default {
  listShifts,
  createShift,
  updateShift,
  deleteShift,
  getShiftHistory,
  computeAllowedLogin,
  computeMinimumLogout,
  formatTime,
}
