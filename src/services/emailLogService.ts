const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

function authHeader() {
  const token = localStorage.getItem('attendance-dashboard-token') || ''
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

export interface EmailLogRow {
  id?: string
  employee_id?: string
  employee_name?: string | null
  recipient_email?: string | null
  email_type?: string | null
  status?: string | null
  sent_at?: string | null
}

export async function listEmailLogs(): Promise<EmailLogRow[]> {
  const response = await fetch(`${API_BASE}/api/ceo/email-logs`, { headers: authHeader() })
  if (!response.ok) throw new Error('Failed to load email logs')
  return response.json()
}

export default { listEmailLogs }
