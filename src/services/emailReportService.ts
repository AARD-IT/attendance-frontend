const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

function authHeader() {
  const token = localStorage.getItem('attendance-dashboard-token') || ''
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

export async function sendMonthlyReportEmail(payload: Record<string, unknown>) {
  const response = await fetch(`${API_BASE}/api/ceo/email-reports/monthly-report`, { method: 'POST', headers: authHeader(), body: JSON.stringify(payload) })
  if (!response.ok) throw new Error('Failed to send monthly report email')
  return response.json()
}

export async function sendLateLoginAlertEmail(payload: Record<string, unknown>) {
  const response = await fetch(`${API_BASE}/api/ceo/email-reports/late-login`, { method: 'POST', headers: authHeader(), body: JSON.stringify(payload) })
  if (!response.ok) throw new Error('Failed to send late login alert email')
  return response.json()
}

export async function sendEarlyLogoutAlertEmail(payload: Record<string, unknown>) {
  const response = await fetch(`${API_BASE}/api/ceo/email-reports/early-logout`, { method: 'POST', headers: authHeader(), body: JSON.stringify(payload) })
  if (!response.ok) throw new Error('Failed to send early logout alert email')
  return response.json()
}

export default { sendMonthlyReportEmail, sendLateLoginAlertEmail, sendEarlyLogoutAlertEmail }
