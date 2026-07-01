const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

export interface NotificationSettingsRow {
  id?: string
  employee_id: string
  employee_email?: string
  cc_email?: string
  monthly_report_mode: 'MANUAL' | 'AUTOMATIC'
  late_login_mode: 'MANUAL' | 'AUTOMATIC'
  early_logout_mode: 'MANUAL' | 'AUTOMATIC'
  missing_punch_mode: 'MANUAL' | 'AUTOMATIC'
  escalation_mode: 'MANUAL' | 'AUTOMATIC'
}

function authHeader() {
  const token = localStorage.getItem('attendance-dashboard-token') || ''
  return { Authorization: `Bearer ${token}` }
}

export async function listNotificationSettings(): Promise<NotificationSettingsRow[]> {
  const res = await fetch(`${API_BASE}/api/notification-settings`, { headers: { ...authHeader() } })
  if (!res.ok) throw new Error('Failed to fetch notification settings')
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function updateNotificationSettings(employeeId: string, payload: Partial<NotificationSettingsRow>) {
  const res = await fetch(`${API_BASE}/api/notification-settings/${employeeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('Failed to update notification settings')
  return await res.json()
}

export default { listNotificationSettings, updateNotificationSettings }
