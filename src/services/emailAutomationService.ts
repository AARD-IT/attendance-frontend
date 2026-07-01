const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

function authHeader() {
  const token = localStorage.getItem('attendance-dashboard-token') || ''
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

export interface AutomationSettingsPayload {
  monthly_report_enabled: boolean
  monthly_report_day: number
  monthly_report_time: string
  monthly_report_cc_enabled?: boolean
  late_login_enabled: boolean
  late_login_delay: 'same_day' | 'tomorrow' | 'day_after_tomorrow'
  late_login_time: string
  late_login_send_immediately?: boolean
  late_login_delay_minutes?: number
  early_logout_enabled: boolean
  early_logout_delay: 'same_day' | 'tomorrow' | 'day_after_tomorrow'
  early_logout_time: string
  early_logout_delay_minutes?: number
  missing_punch_enabled?: boolean
  missing_punch_delay_minutes?: number
  escalation_enabled?: boolean
  escalation_late_threshold?: number
  escalation_deviation_threshold?: number
  escalation_recipients?: string
  updated_at?: string
}

export async function loadAutomationSettings() {
  const response = await fetch(`${API_BASE}/api/automation-settings`, { headers: authHeader() })
  if (!response.ok) throw new Error('Failed to load automation settings')
  return await response.json()
}

export async function createDefaultAutomationSettings() {
  return loadAutomationSettings()
}

export async function saveAutomationSettings(payload: AutomationSettingsPayload) {
  const response = await fetch(`${API_BASE}/api/automation-settings`, {
    method: 'PUT',
    headers: authHeader(),
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error('Failed to save automation settings')
  return await response.json()
}

export default { loadAutomationSettings, createDefaultAutomationSettings, saveAutomationSettings }
