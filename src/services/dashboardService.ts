import shiftManagementService from './shiftManagementService'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')
const CACHE_TTL_MS = 10 * 60 * 1000

interface DashboardSummaryResponse {
  total_employees?: number
  present_today?: number
  absent_today?: number
  late_arrivals?: number
  attendance_percentage?: number
}

interface LiveAttendanceFeedItem {
  employee_name?: string
  date?: string
  check_in?: string
  check_out?: string
  status?: string
  total_hours?: number
}

interface EmployeeAttendanceTableItem {
  employee_id?: string
  employee_name?: string
  employee_code?: string
  department?: string
  average_working_hours?: number
  average_login_time?: string
  average_logout_time?: string
  total_late_count?: number
  login_deviation?: number
  logout_deviation?: number
  escalations?: number
}

function authHeader() {
  const token = localStorage.getItem('attendance-dashboard-token') || ''
  return { Authorization: `Bearer ${token}` }
}

function cacheKey(name: string, params: URLSearchParams) {
  return `dashboard-cache:${name}:${params.toString()}`
}

function readCache<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { expiresAt: number; value: T }
    if (parsed.expiresAt < Date.now()) {
      sessionStorage.removeItem(key)
      return null
    }
    return parsed.value
  } catch {
    return null
  }
}

function writeCache<T>(key: string, value: T) {
  sessionStorage.setItem(key, JSON.stringify({ expiresAt: Date.now() + CACHE_TTL_MS, value }))
}

async function fetchWithCache<T>(name: string, url: string, options?: { forceRefresh?: boolean }): Promise<T> {
  const key = cacheKey(name, new URL(url).searchParams)

  if (!options?.forceRefresh) {
    const cached = readCache<T>(key)
    if (cached) return cached
  }

  const res = await fetch(url, { headers: { ...authHeader() } })
  if (!res.ok) throw new Error(`Failed to fetch ${name}`)

  const data = await res.json()
  writeCache(key, data)
  return data
}

export async function getDashboardSummary(month?: number, year?: number, options?: { forceRefresh?: boolean }): Promise<DashboardSummaryResponse> {
  const params = new URLSearchParams()
  if (month) params.set('month', String(month))
  if (year) params.set('year', String(year))
  return fetchWithCache<DashboardSummaryResponse>('dashboard-summary', `${API_BASE}/api/dashboard/summary${params.toString() ? `?${params.toString()}` : ''}`, options)
}

export async function getDashboardTrends(month?: number, year?: number, options?: { forceRefresh?: boolean }) {
  const params = new URLSearchParams()
  if (month) params.set('month', String(month))
  if (year) params.set('year', String(year))
  return fetchWithCache('dashboard-trends', `${API_BASE}/api/dashboard/trends${params.toString() ? `?${params.toString()}` : ''}`, options)
}

export async function getDepartmentAnalytics(options?: { forceRefresh?: boolean }) {
  return fetchWithCache('department-analytics', `${API_BASE}/api/dashboard/departments`, options)
}

export async function getWorkingHours(month?: number, year?: number, options?: { forceRefresh?: boolean }) {
  const params = new URLSearchParams()
  if (month) params.set('month', String(month))
  if (year) params.set('year', String(year))
  return fetchWithCache('working-hours', `${API_BASE}/api/dashboard/working-hours${params.toString() ? `?${params.toString()}` : ''}`, options)
}

export async function getEmployeeAttendanceTable(month?: number, year?: number, options?: { forceRefresh?: boolean }): Promise<EmployeeAttendanceTableItem[]> {
  const params = new URLSearchParams()
  if (month) params.set('month', String(month))
  if (year) params.set('year', String(year))
  return fetchWithCache<EmployeeAttendanceTableItem[]>('employee-attendance-table', `${API_BASE}/api/dashboard/employees${params.toString() ? `?${params.toString()}` : ''}`, options)
}

export async function getEmployeeDetail(employeeId: string, month?: number, year?: number, options?: { forceRefresh?: boolean }) {
  const params = new URLSearchParams()
  if (month) params.set('month', String(month))
  if (year) params.set('year', String(year))

  const detail = await fetchWithCache(`employee-detail:${employeeId}`, `${API_BASE}/api/dashboard/employees/${employeeId}${params.toString() ? `?${params.toString()}` : ''}`, options)

  const normalized = {
    ...detail,
    employee_id: String(detail?.employee_id || employeeId),
    employee_name: String(detail?.employee_name || 'Unknown Employee'),
    employee_code: String(detail?.employee_code || employeeId || ''),
    employee_email: detail?.employee_email || detail?.email || detail?.email_address || null,
    shift_type: detail?.shift_type || detail?.current_shift || detail?.shift || null,
    current_shift: detail?.current_shift || detail?.shift_type || detail?.shift || null,
  } as Record<string, unknown>

  try {
    const [preferences, assignments] = await Promise.all([
      fetch(`${API_BASE}/api/ceo/email-preferences`, { headers: { ...authHeader() } }).then((res) => (res.ok ? res.json() : [])).catch(() => []),
      shiftManagementService.getShiftAssignments(),
    ])

    const preference = Array.isArray(preferences)
      ? (preferences as Array<Record<string, unknown>>).find((item) => String(item.employee_id) === String(employeeId))
      : null

    const assignment = Array.isArray(assignments)
      ? (assignments as Array<Record<string, unknown>>).find((item) => String(item.employee_id) === String(employeeId))
      : null

    if (!normalized.employee_email && preference?.employee_email) {
      normalized.employee_email = String(preference.employee_email)
    }

    if (!normalized.current_shift && assignment?.shift_type) {
      normalized.current_shift = String(assignment.shift_type)
      normalized.shift_type = String(assignment.shift_type)
    }
  } catch {
    // Keep the detail response as-is when additional profile lookups fail.
  }

  return normalized
}

export async function getEmployeeAttendanceAnalytics(employeeId: string, month?: number, year?: number, options?: { forceRefresh?: boolean }) {
  const params = new URLSearchParams()
  if (month) params.set('month', String(month))
  if (year) params.set('year', String(year))
  return fetchWithCache(`employee-attendance-analytics:${employeeId}`, `${API_BASE}/api/v1/employees/${employeeId}/attendance${params.toString() ? `?${params.toString()}` : ''}`, options)
}

export async function getLiveAttendanceFeed(month?: number, year?: number, options?: { forceRefresh?: boolean }): Promise<LiveAttendanceFeedItem[]> {
  const params = new URLSearchParams()
  if (month) params.set('month', String(month))
  if (year) params.set('year', String(year))
  return fetchWithCache<LiveAttendanceFeedItem[]>('live-attendance-feed', `${API_BASE}/api/dashboard/live${params.toString() ? `?${params.toString()}` : ''}`, options)
}

export async function syncMinervaAll() {
  const res = await fetch(`${API_BASE}/api/minerva-sync/all`, {
    method: 'POST',
    headers: { ...authHeader() },
  })

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    throw new Error(detail?.detail || 'Failed to refresh Minerva data')
  }

  return await res.json()
}

export async function getMinervaSyncStatus() {
  const res = await fetch(`${API_BASE}/api/minerva-sync/status`, {
    headers: { ...authHeader() },
  })

  if (!res.ok) {
    throw new Error('Failed to fetch synchronization status')
  }

  return await res.json()
}

export default { getDashboardSummary, getDashboardTrends, getDepartmentAnalytics, getWorkingHours, getEmployeeAttendanceTable, getEmployeeDetail, getEmployeeAttendanceAnalytics, getLiveAttendanceFeed, syncMinervaAll, getMinervaSyncStatus }
