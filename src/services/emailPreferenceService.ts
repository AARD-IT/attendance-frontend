const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

function authHeader() {
  const token = localStorage.getItem('attendance-dashboard-token') || ''
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

export interface EmailPreferenceRow {
  id: string
  employee_id: string
  employee_name: string | null
  employee_email: string | null
  monthly_report_mode: 'manual' | 'auto'
  late_login_mode: 'manual' | 'auto'
  early_logout_mode: 'manual' | 'auto'
  created_at?: string
  updated_at?: string
}

export async function listEmailPreferences(): Promise<EmailPreferenceRow[]> {
  const response = await fetch(`${API_BASE}/api/ceo/email-preferences`, { headers: authHeader() })
  if (!response.ok) throw new Error('Failed to load communication preferences')
  return response.json()
}

export async function ensureEmailPreference(employee: { employee_id: string; employee_name: string; employee_email?: string }) {
  const response = await fetch(`${API_BASE}/api/ceo/email-preferences/ensure`, {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify(employee),
  })
  if (!response.ok) throw new Error('Failed to create communication preferences')
  return response.json()
}

export async function updateEmailPreference(employeeId: string, modeType: 'monthly_report_mode' | 'late_login_mode' | 'early_logout_mode', modeValue: 'manual' | 'auto') {
  const response = await fetch(`${API_BASE}/api/ceo/email-preferences/${employeeId}`, {
    method: 'PATCH',
    headers: authHeader(),
    body: JSON.stringify({ mode_type: modeType, mode_value: modeValue }),
  })
  if (!response.ok) throw new Error('Failed to update communication preferences')
  return response.json()
}
