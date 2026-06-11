export interface EmailAutomationSettingsRow {
  id: string
  monthly_report_enabled: boolean
  monthly_report_day: number
  monthly_report_time: string
  late_login_enabled: boolean
  late_login_delay: string
  late_login_time: string
  early_logout_enabled: boolean
  early_logout_delay: string
  early_logout_time: string
  created_at: string
  updated_at: string
}

export interface EmailPreferenceRow {
  id: string
  employee_id: string | null
  employee_name: string | null
  employee_email: string | null
  monthly_report_mode: 'manual' | 'auto'
  late_login_mode: 'manual' | 'auto'
  early_logout_mode: 'manual' | 'auto'
  created_at: string
  updated_at: string
}

export interface EmailLogRow {
  id: string
  employee_id: string | null
  employee_name: string | null
  employee_email: string | null
  cc_email: string | null
  email_type: string | null
  subject: string | null
  email_body: string | null
  status: 'pending' | 'sent' | 'failed'
  provider: string | null
  provider_message_id: string | null
  sent_at: string | null
  created_at: string
}

export interface EmailTemplateRow {
  id: string
  template_name: string
  email_subject: string | null
  email_body: string | null
  active: boolean
  created_at: string
  updated_at: string
}
