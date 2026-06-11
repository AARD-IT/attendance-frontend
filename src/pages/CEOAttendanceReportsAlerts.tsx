import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import CEOSidebar from '../components/CEOSidebar'
import { useAuth } from '../contexts/AuthContext'
import dashboardService from '../services/dashboardService'
import { createDefaultAutomationSettings, loadAutomationSettings, saveAutomationSettings, type AutomationSettingsPayload } from '../services/emailAutomationService'
import { ensureEmailPreference, type EmailPreferenceRow, updateEmailPreference } from '../services/emailPreferenceService'
import { listEmailLogs, type EmailLogRow } from '../services/emailLogService'
import shiftManagementService from '../services/shiftManagementService'

interface EmployeeRow {
  employee_id: string
  employee_name: string
  employee_email?: string
  department?: string
  average_working_hours?: number
  average_login_time?: string
  average_logout_time?: string
  total_late_count?: number
}

const defaultAutomationSettings: AutomationSettingsPayload = {
  monthly_report_enabled: false,
  monthly_report_day: 5,
  monthly_report_time: '09:00',
  late_login_enabled: false,
  late_login_delay: 'same_day',
  late_login_time: '18:00',
  early_logout_enabled: false,
  early_logout_delay: 'same_day',
  early_logout_time: '22:30',
  updated_at: new Date().toISOString(),
}


export default function CEOAttendanceReportsAlerts() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [error, setError] = useState('')
  const [automationSettings, setAutomationSettings] = useState<AutomationSettingsPayload>(defaultAutomationSettings)
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [preferencesByEmployee, setPreferencesByEmployee] = useState<Record<string, EmailPreferenceRow>>({})
  const [assignments, setAssignments] = useState<Record<string, any>>({})
  const [loadingPreferences, setLoadingPreferences] = useState(false)
  const [savingEmployeeId, setSavingEmployeeId] = useState<string | null>(null)
  const [emailLogs, setEmailLogs] = useState<EmailLogRow[]>([])
  const [loadingEmailLogs, setLoadingEmailLogs] = useState(false)

  useEffect(() => {
    const load = async () => {
      if (!auth.token) {
        setIsLoadingSettings(false)
        return
      }

      try {
        setLoadingPreferences(true)
        const [rows, remoteAssignments] = await Promise.all([
          dashboardService.getEmployeeAttendanceTable(new Date().getMonth() + 1, new Date().getFullYear()),
          shiftManagementService.getShiftAssignments(),
        ])

        setLoadingEmailLogs(true)
        try {
          const logs = await listEmailLogs()
          setEmailLogs(Array.isArray(logs) ? logs : [])
        } finally {
          setLoadingEmailLogs(false)
        }

        const fallbackAssignments = (() => {
          try {
            return JSON.parse(localStorage.getItem('shift-management-assignments') || '[]')
          } catch {
            return []
          }
        })()

        const mergedAssignments = [...(Array.isArray(remoteAssignments) ? remoteAssignments : []), ...fallbackAssignments]
        const assignmentMap = new Map<string, Record<string, unknown>>()
        for (const assignment of mergedAssignments) {
          if (assignment?.employee_id) {
            assignmentMap.set(String(assignment.employee_id), assignment as Record<string, unknown>)
          }
        }
        setAssignments(Object.fromEntries(assignmentMap))

        const employeeRows = rows as EmployeeRow[]
        setEmployees(employeeRows)

        const preferenceMap: Record<string, EmailPreferenceRow> = {}
        for (const employee of employeeRows) {
          const assignment = assignmentMap.get(String(employee.employee_id)) || {}
          const email = String(assignment.employee_email || `${String(employee.employee_name || 'employee').toLowerCase().replace(/\s+/g, '.')}@company.com`)
          const preference = await ensureEmailPreference({
            employee_id: String(employee.employee_id),
            employee_name: String(employee.employee_name || 'Employee'),
            employee_email: email,
          })
          preferenceMap[String(employee.employee_id)] = preference as EmailPreferenceRow
        }
        setPreferencesByEmployee(preferenceMap)

        const existing = await loadAutomationSettings()
        if (existing) {
          setSettingsId(existing.id)
          setAutomationSettings({
            monthly_report_enabled: Boolean(existing.monthly_report_enabled),
            monthly_report_day: Number(existing.monthly_report_day || 5),
            monthly_report_time: String(existing.monthly_report_time || '09:00'),
            late_login_enabled: Boolean(existing.late_login_enabled),
            late_login_delay: (existing.late_login_delay || 'same_day') as AutomationSettingsPayload['late_login_delay'],
            late_login_time: String(existing.late_login_time || '18:00'),
            early_logout_enabled: Boolean(existing.early_logout_enabled),
            early_logout_delay: (existing.early_logout_delay || 'same_day') as AutomationSettingsPayload['early_logout_delay'],
            early_logout_time: String(existing.early_logout_time || '22:30'),
            updated_at: existing.updated_at || new Date().toISOString(),
          })
        } else {
          const created = await createDefaultAutomationSettings()
          setSettingsId(created?.id || null)
          setAutomationSettings({
            ...defaultAutomationSettings,
            monthly_report_day: Number(created?.monthly_report_day || 5),
            monthly_report_time: String(created?.monthly_report_time || '09:00'),
            late_login_time: String(created?.late_login_time || '18:00'),
            early_logout_time: String(created?.early_logout_time || '22:30'),
          })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load employee communication data')
      } finally {
        setLoadingPreferences(false)
        setIsLoadingSettings(false)
      }
    }

    load()
  }, [auth.token])

  const employeeProfiles = useMemo(() => {
    return employees.map((employee) => {
      const assignment = assignments[String(employee.employee_id)] || {}
      const preference = preferencesByEmployee[String(employee.employee_id)]
      const email = String(preference?.employee_email || assignment.employee_email || employee.employee_email || `${String(employee.employee_name || 'employee').toLowerCase().replace(/\s+/g, '.')}@company.com`)

      return {
        ...employee,
        email,
        cc_email: String(assignment.cc_email || ''),
        shift: String(assignment.shift_type || 'Shift 1'),
      }
    })
  }, [assignments, employees, preferencesByEmployee])

  const handlePreferenceChange = async (employeeId: string, modeType: 'monthly_report_mode' | 'late_login_mode' | 'early_logout_mode', modeValue: 'manual' | 'auto') => {
    try {
      setSavingEmployeeId(employeeId)
      const updated = await updateEmailPreference(employeeId, modeType, modeValue)
      setPreferencesByEmployee((prev) => ({
        ...prev,
        [employeeId]: updated as EmailPreferenceRow,
      }))
      setFeedback({ type: 'success', message: 'Communication preferences updated.' })
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to update communication preferences.' })
    } finally {
      setSavingEmployeeId(null)
    }
  }

  const handleLogout = async () => {
    await auth.logout()
    navigate('/login', { replace: true })
  }

  const handleSaveSettings = async () => {
    if (!auth.token) {
      setFeedback({ type: 'error', message: 'You must be signed in to save automation settings.' })
      return
    }

    if (!/^\d{1,2}$/.test(String(automationSettings.monthly_report_day)) || Number(automationSettings.monthly_report_day) < 1 || Number(automationSettings.monthly_report_day) > 31) {
      setFeedback({ type: 'error', message: 'Monthly report day must be between 1 and 31.' })
      return
    }

    if (!/^\d{2}:\d{2}$/.test(automationSettings.monthly_report_time) || !/^\d{2}:\d{2}$/.test(automationSettings.late_login_time) || !/^\d{2}:\d{2}$/.test(automationSettings.early_logout_time)) {
      setFeedback({ type: 'error', message: 'Delivery times must use the HH:MM format.' })
      return
    }

    try {
      setIsSaving(true)
      setFeedback(null)
      await saveAutomationSettings({
        ...automationSettings,
        updated_at: new Date().toISOString(),
      }, settingsId || undefined)
      setFeedback({ type: 'success', message: 'Automation settings saved successfully.' })
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Unable to save automation settings.' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className={collapsed ? 'min-h-screen bg-slate-100 text-slate-900 transition-all duration-300 lg:pl-24' : 'min-h-screen bg-slate-100 text-slate-900 transition-all duration-300 lg:pl-72'}>
      <CEOSidebar collapsed={collapsed} onToggle={() => setCollapsed((prev) => !prev)} />
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-indigo-600">Analytics Avenue</p>
            <h1 className="text-3xl font-bold">ATTENDANCE REPORTS & ALERTS</h1>
            <p className="text-sm text-slate-600">Manage attendance reports, employee notifications, email preferences, automation schedules, and communication history.</p>
          </div>
          <button onClick={handleLogout} className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">Sign Out</button>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <p className="text-sm uppercase tracking-[0.25em] text-indigo-600">Automation Settings</p>
            <h2 className="text-xl font-semibold">Automation Settings</h2>
            <p className="text-sm text-slate-500">Configure organization-wide attendance report and alert delivery preferences.</p>
          </div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Save the organization-wide delivery preferences for attendance reports and alerts.</p>
            </div>
            <button type="button" onClick={handleSaveSettings} disabled={isSaving || isLoadingSettings} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400">{isSaving ? 'Saving…' : 'Save Settings'}</button>
          </div>
          {feedback ? <div className={`mb-4 rounded-2xl border p-3 text-sm ${feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{feedback.message}</div> : null}
          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Monthly Attendance Reports</h3>
                  <p className="mt-1 text-sm text-slate-500">Choose when attendance reports are generated and sent.</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">Live</span>
              </div>
              <div className="mt-5 space-y-3 text-sm text-slate-700">
                <label className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2"><span>Enabled</span><input type="checkbox" checked={automationSettings.monthly_report_enabled} onChange={(event) => setAutomationSettings((prev) => ({ ...prev, monthly_report_enabled: event.target.checked }))} disabled={isSaving || isLoadingSettings} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" /></label>
                <label className="flex flex-col gap-1 rounded-2xl bg-white px-3 py-2"><span>Generation Day</span><input type="number" min="1" max="31" value={automationSettings.monthly_report_day} onChange={(event) => setAutomationSettings((prev) => ({ ...prev, monthly_report_day: Number(event.target.value) || 1 }))} disabled={isSaving || isLoadingSettings} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900" /></label>
                <label className="flex flex-col gap-1 rounded-2xl bg-white px-3 py-2"><span>Delivery Time</span><input type="time" value={automationSettings.monthly_report_time} onChange={(event) => setAutomationSettings((prev) => ({ ...prev, monthly_report_time: event.target.value }))} disabled={isSaving || isLoadingSettings} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900" /></label>
              </div>
            </article>
            <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Late Login Alerts</h3>
                  <p className="mt-1 text-sm text-slate-500">Configure late-login alert timing and delivery window.</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">Live</span>
              </div>
              <div className="mt-5 space-y-3 text-sm text-slate-700">
                <label className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2"><span>Enabled</span><input type="checkbox" checked={automationSettings.late_login_enabled} onChange={(event) => setAutomationSettings((prev) => ({ ...prev, late_login_enabled: event.target.checked }))} disabled={isSaving || isLoadingSettings} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" /></label>
                <label className="flex flex-col gap-1 rounded-2xl bg-white px-3 py-2"><span>Alert Timing</span><select value={automationSettings.late_login_delay} onChange={(event) => setAutomationSettings((prev) => ({ ...prev, late_login_delay: event.target.value as AutomationSettingsPayload['late_login_delay'] }))} disabled={isSaving || isLoadingSettings} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900"><option value="same_day">Same Day</option><option value="tomorrow">Next Day</option><option value="day_after_tomorrow">2 Days Later</option></select></label>
                <label className="flex flex-col gap-1 rounded-2xl bg-white px-3 py-2"><span>Delivery Time</span><input type="time" value={automationSettings.late_login_time} onChange={(event) => setAutomationSettings((prev) => ({ ...prev, late_login_time: event.target.value }))} disabled={isSaving || isLoadingSettings} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900" /></label>
              </div>
            </article>
            <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Early Logout Alerts</h3>
                  <p className="mt-1 text-sm text-slate-500">Set the alert timing for early logout notifications.</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">Live</span>
              </div>
              <div className="mt-5 space-y-3 text-sm text-slate-700">
                <label className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2"><span>Enabled</span><input type="checkbox" checked={automationSettings.early_logout_enabled} onChange={(event) => setAutomationSettings((prev) => ({ ...prev, early_logout_enabled: event.target.checked }))} disabled={isSaving || isLoadingSettings} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" /></label>
                <label className="flex flex-col gap-1 rounded-2xl bg-white px-3 py-2"><span>Alert Timing</span><select value={automationSettings.early_logout_delay} onChange={(event) => setAutomationSettings((prev) => ({ ...prev, early_logout_delay: event.target.value as AutomationSettingsPayload['early_logout_delay'] }))} disabled={isSaving || isLoadingSettings} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900"><option value="same_day">Same Day</option><option value="tomorrow">Next Day</option><option value="day_after_tomorrow">2 Days Later</option></select></label>
                <label className="flex flex-col gap-1 rounded-2xl bg-white px-3 py-2"><span>Delivery Time</span><input type="time" value={automationSettings.early_logout_time} onChange={(event) => setAutomationSettings((prev) => ({ ...prev, early_logout_time: event.target.value }))} disabled={isSaving || isLoadingSettings} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900" /></label>
              </div>
            </article>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <p className="text-sm uppercase tracking-[0.25em] text-indigo-600">Employee Communication Settings</p>
            <h2 className="text-xl font-semibold">Employee Communication Settings</h2>
            <p className="text-sm text-slate-500">Manage report and alert preferences for individual employees.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full table-fixed text-sm md:min-w-full">
              <thead>
                <tr className="border-b border-slate-200 text-left align-top text-slate-500">
                  <th className="px-3 py-3 align-top">Employee Name</th>
                  <th className="px-3 py-3 align-top">Email Address</th>
                  <th className="px-3 py-3">Monthly Report</th>
                  <th className="px-3 py-3">Late Login Alerts</th>
                  <th className="px-3 py-3">Early Logout Alerts</th>
                  <th className="px-3 py-3">View</th>
                </tr>
              </thead>
              <tbody>
                {loadingPreferences ? Array.from({ length: 4 }).map((_, index) => (
                  <tr key={`skeleton-${index}`} className="border-b border-slate-100 align-top">
                    <td className="px-3 py-3 align-top"><div className="h-4 w-32 animate-pulse rounded bg-slate-200" /></td>
                    <td className="px-3 py-3"><div className="h-4 w-40 animate-pulse rounded bg-slate-200" /></td>
                    <td className="px-3 py-3"><div className="h-8 w-24 animate-pulse rounded-full bg-slate-200" /></td>
                    <td className="px-3 py-3"><div className="h-8 w-24 animate-pulse rounded-full bg-slate-200" /></td>
                    <td className="px-3 py-3"><div className="h-8 w-24 animate-pulse rounded-full bg-slate-200" /></td>
                    <td className="px-3 py-3"><div className="h-8 w-16 animate-pulse rounded-xl bg-slate-200" /></td>
                  </tr>
                )) : employeeProfiles.map((employee) => {
                  const preference = preferencesByEmployee[String(employee.employee_id)]
                  const formatMode = (value?: string) => value === 'auto' ? 'Automated' : 'Manual'
                  return (
                    <tr key={employee.employee_id} className="border-b border-slate-100 align-top hover:bg-slate-50">
                      <td className="px-3 py-3 align-top font-semibold text-slate-900"><span className="block max-w-[180px] break-words">{employee.employee_name}</span></td>
                      <td className="px-3 py-3 align-top text-slate-600"><span className="block max-w-[240px] break-all whitespace-normal">{employee.email}</span></td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <select value={preference?.monthly_report_mode || 'manual'} onChange={(event) => handlePreferenceChange(String(employee.employee_id), 'monthly_report_mode', event.target.value as 'manual' | 'auto')} disabled={savingEmployeeId === String(employee.employee_id)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100">
                            <option value="manual">Manual</option>
                            <option value="auto">Auto</option>
                          </select>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${preference?.monthly_report_mode === 'auto' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{formatMode(preference?.monthly_report_mode)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <select value={preference?.late_login_mode || 'manual'} onChange={(event) => handlePreferenceChange(String(employee.employee_id), 'late_login_mode', event.target.value as 'manual' | 'auto')} disabled={savingEmployeeId === String(employee.employee_id)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100">
                            <option value="manual">Manual</option>
                            <option value="auto">Auto</option>
                          </select>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${preference?.late_login_mode === 'auto' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{formatMode(preference?.late_login_mode)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <select value={preference?.early_logout_mode || 'manual'} onChange={(event) => handlePreferenceChange(String(employee.employee_id), 'early_logout_mode', event.target.value as 'manual' | 'auto')} disabled={savingEmployeeId === String(employee.employee_id)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100">
                            <option value="manual">Manual</option>
                            <option value="auto">Auto</option>
                          </select>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${preference?.early_logout_mode === 'auto' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{formatMode(preference?.early_logout_mode)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3"><Link to={`/ceo/attendance-reports-alerts/${employee.employee_id}`} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">View</Link></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <p className="text-sm uppercase tracking-[0.25em] text-indigo-600">Email Activity Log</p>
            <h2 className="text-xl font-semibold">Email Activity Log</h2>
            <p className="text-sm text-slate-500">Track attendance reports and alerts sent to employees.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Employee</th>
                  <th className="px-3 py-3">Email Type</th>
                  <th className="px-3 py-3">Recipient</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {loadingEmailLogs ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">Loading email logs…</td>
                  </tr>
                ) : emailLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">No email logs found.</td>
                  </tr>
                ) : emailLogs.map((item) => (
                  <tr key={item.id || `${item.sent_at}-${item.employee_name}`} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-3 text-slate-900">{item.sent_at ? new Date(item.sent_at).toLocaleString() : '—'}</td>
                    <td className="px-3 py-3 text-slate-900">{item.employee_name || 'Employee'}</td>
                    <td className="px-3 py-3 text-slate-600">{item.email_type || 'Email'}</td>
                    <td className="px-3 py-3 text-slate-600"><a className="text-indigo-700 underline" href={`mailto:${item.recipient_email || ''}`}>{item.recipient_email || '—'}</a></td>
                    <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${String(item.status || '').toUpperCase() === 'SENT' ? 'bg-emerald-100 text-emerald-700' : String(item.status || '').toUpperCase() === 'FAILED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{item.status || 'PENDING'}</span></td>
                    <td className="px-3 py-3"><button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}
