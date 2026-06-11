const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || 'https://xakogrhvnblqkscztuyt.supabase.co').replace(/\/$/, '')
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Bcv_56UrWbC77pILFeN8Nw_SxgOsTSW'

function authHeaders() {
  const token = localStorage.getItem('attendance-dashboard-token') || ''
  return {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${token}`,
    'Prefer': 'return=representation',
  }
}

export interface AutomationSettingsPayload {
  monthly_report_enabled: boolean
  monthly_report_day: number
  monthly_report_time: string
  late_login_enabled: boolean
  late_login_delay: 'same_day' | 'tomorrow' | 'day_after_tomorrow'
  late_login_time: string
  early_logout_enabled: boolean
  early_logout_delay: 'same_day' | 'tomorrow' | 'day_after_tomorrow'
  early_logout_time: string
  updated_at: string
}

export async function loadAutomationSettings() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/email_automation_settings?select=*&limit=1`, {
    headers: authHeaders(),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(detail || 'Failed to load automation settings')
  }

  const rows = await response.json()
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : rows || null
}

export async function createDefaultAutomationSettings() {
  const payload = {
    monthly_report_enabled: false,
    monthly_report_day: 5,
    monthly_report_time: '09:00',
    late_login_enabled: false,
    late_login_delay: 'same_day',
    late_login_time: '18:00',
    early_logout_enabled: false,
    early_logout_delay: 'same_day',
    early_logout_time: '22:30',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/email_automation_settings`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(detail || 'Failed to create automation settings')
  }

  const data = await response.json()
  return Array.isArray(data) ? data[0] || null : data || null
}

export async function saveAutomationSettings(payload: AutomationSettingsPayload, existingId?: string) {
  const body = {
    ...payload,
    updated_at: new Date().toISOString(),
  }

  if (existingId) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/email_automation_settings?id=eq.${existingId}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(detail || 'Failed to save automation settings')
    }

    const data = await response.json()
    return Array.isArray(data) ? data[0] || null : data || null
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/email_automation_settings`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      ...body,
      created_at: new Date().toISOString(),
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(detail || 'Failed to save automation settings')
  }

  const data = await response.json()
  return Array.isArray(data) ? data[0] || null : data || null
}
