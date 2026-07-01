const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

function authHeader() {
  const token = localStorage.getItem('attendance-dashboard-token') || ''
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

export interface EmailLogRow {
  id?: string
  employee_id?: string
  employee_name?: string | null
  employee_email?: string | null
  cc_email?: string | null
  email_type?: string | null
  status?: string | null
  source?: string | null
  delivery_status?: string | null
  sent_by?: string | null
  sent_at?: string | null
  created_at?: string | null
}

export async function listEmailLogs(params?: {
  employee_id?: string
  email_type?: string
  source?: string
  from_date?: string
  to_date?: string
}): Promise<EmailLogRow[]> {
  const search = new URLSearchParams()
  if (params?.employee_id) search.set('employee_id', params.employee_id)
  if (params?.email_type) search.set('email_type', params.email_type)
  if (params?.source) search.set('source', params.source)
  if (params?.from_date) search.set('from_date', params.from_date)
  if (params?.to_date) search.set('to_date', params.to_date)
  const query = search.toString() ? `?${search.toString()}` : ''
  const response = await fetch(`${API_BASE}/api/email-history${query}`, { headers: authHeader() })
  if (!response.ok) {
    const fallback = await fetch(`${API_BASE}/api/ceo/email-logs`, { headers: authHeader() })
    if (!fallback.ok) throw new Error('Failed to load email logs')
    return fallback.json()
  }
  return response.json()
}

export function exportEmailLogsCsv(rows: EmailLogRow[]) {
  const headers = ['Date Time', 'Employee', 'Email Type', 'To', 'CC', 'Status', 'Source', 'Delivery Status', 'Sent By']
  const lines = rows.map((row) => [
    row.sent_at || row.created_at || '',
    row.employee_name || '',
    row.email_type || '',
    row.employee_email || '',
    row.cc_email || '',
    row.status || '',
    row.source || '',
    row.delivery_status || '',
    row.sent_by || '',
  ])
  const csv = [headers, ...lines].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `email-history-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export default { listEmailLogs, exportEmailLogsCsv }
