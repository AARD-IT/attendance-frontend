const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

function authHeader() {
  const token = localStorage.getItem('attendance-dashboard-token') || ''
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

export type ManualEmailType =
  | 'monthly_report'
  | 'late_login_alert'
  | 'early_logout_alert'
  | 'missing_punch_alert'
  | 'escalation_alert'

export async function sendManualEmail(payload: {
  email_type: ManualEmailType
  employee_id: string
  employee_name: string
  recipient_email: string
  cc_email?: string
  attendance_date?: string
  month?: number
  year?: number
  date_range?: { from: string; to: string }
  template?: string
  record?: Record<string, unknown>
  assignment?: Record<string, unknown>
  classification?: Record<string, unknown>
}) {
  const response = await fetch(`${API_BASE}/api/email/manual-send`, {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.detail || 'Failed to send email')
  }
  return await response.json()
}

export default { sendManualEmail }
