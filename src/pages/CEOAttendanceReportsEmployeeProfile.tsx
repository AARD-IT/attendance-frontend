import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import CEOSidebar from '../components/CEOSidebar'
import { useAuth } from '../contexts/AuthContext'
import dashboardService from '../services/dashboardService'
import { ensureEmailPreference, listEmailPreferences, type EmailPreferenceRow } from '../services/emailPreferenceService'
import { sendEarlyLogoutAlertEmail, sendLateLoginAlertEmail, sendMonthlyReportEmail } from '../services/emailReportService'

interface EmployeeProfileDetail {
  employee_id: string
  employee_name: string
  employee_code?: string
  employee_email?: string | null
  current_shift?: string | null
  shift_type?: string | null
  records?: Array<Record<string, any>>
}

interface PreviewData {
  totalWorkingDays: number
  presentDays: number
  absentDays: number
  lateLoginDays: number
  earlyLogoutDays: number
  attendancePercentage: number
  latestLateDate: string
  latestEarlyDate: string
  expectedLoginTime: string
  actualLoginTime: string
  expectedLogoutTime: string
  actualLogoutTime: string
}

export default function CEOAttendanceReportsEmployeeProfile() {
  const { employeeId } = useParams()
  const auth = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [employee, setEmployee] = useState<EmployeeProfileDetail | null>(null)
  const [preferences, setPreferences] = useState<EmailPreferenceRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [sendingType, setSendingType] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      if (!auth.token || !employeeId) {
        setLoading(false)
        return
      }
      try {
        const detail = (await dashboardService.getEmployeeDetail(String(employeeId), new Date().getMonth() + 1, new Date().getFullYear())) as unknown as EmployeeProfileDetail
        setEmployee(detail)

        const email = String(detail.employee_email || `${String(detail.employee_name || 'employee').toLowerCase().replace(/\s+/g, '.')}@company.com`)
        const ensured = await ensureEmailPreference({
          employee_id: String(detail.employee_id || employeeId),
          employee_name: String(detail.employee_name || 'Employee'),
          employee_email: email,
        })
        const allPreferences = await listEmailPreferences()
        const current = (allPreferences as EmailPreferenceRow[]).find((item) => String(item.employee_id) === String(detail.employee_id || employeeId)) || ensured
        setPreferences(current)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load employee profile')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [auth.token, employeeId])

  const emailAddress = useMemo(() => {
    if (employee?.employee_email) return employee.employee_email
    const name = employee?.employee_name || 'employee'
    return `${name.toLowerCase().replace(/\s+/g, '.')}@company.com`
  }, [employee])

  const currentShift = useMemo(() => {
    if (employee?.current_shift || employee?.shift_type) {
      return String(employee.current_shift || employee.shift_type)
    }

    return 'Not assigned'
  }, [employee])

  const recipientEmail = useMemo(() => String(employee?.employee_email || `${String(employee?.employee_name || 'employee').toLowerCase().replace(/\s+/g, '.')}@company.com`), [employee])
  const formatMode = (value?: string) => (value === 'auto' ? 'Automated' : 'Manual')

  const latestLateRecord = useMemo(() => {
    const records = Array.isArray(employee?.records) ? employee.records : []
    return [...records]
      .filter((record: any) => Boolean(record.is_late || /late/i.test(String(record.status || ''))))
      .sort((a: any, b: any) => String(b.date || '').localeCompare(String(a.date || '')))[0] || null
  }, [employee])

  const latestEarlyRecord = useMemo(() => {
    const records = Array.isArray(employee?.records) ? employee.records : []
    return [...records]
      .filter((record: any) => Boolean(record.is_early_out || /early/i.test(String(record.status || ''))))
      .sort((a: any, b: any) => String(b.date || '').localeCompare(String(a.date || '')))[0] || null
  }, [employee])

  const previewData = useMemo<PreviewData>(() => {
    const records = Array.isArray(employee?.records) ? employee.records : []
    const totalWorkingDays = records.length
    const presentDays = records.filter((record: any) => !/missing/i.test(String(record.status || '')) && record.first_punch && record.last_punch).length
    const lateLoginDays = records.filter((record: any) => Boolean(record.is_late || /late/i.test(String(record.status || '')))).length
    const earlyLogoutDays = records.filter((record: any) => Boolean(record.is_early_out || /early/i.test(String(record.status || '')))).length

    return {
      totalWorkingDays,
      presentDays,
      absentDays: Math.max(0, totalWorkingDays - presentDays),
      lateLoginDays,
      earlyLogoutDays,
      attendancePercentage: totalWorkingDays ? Math.round((presentDays / totalWorkingDays) * 100) : 0,
      latestLateDate: latestLateRecord?.date || '—',
      latestEarlyDate: latestEarlyRecord?.date || '—',
      expectedLoginTime: '09:00 AM',
      actualLoginTime: latestLateRecord?.first_punch || '—',
      expectedLogoutTime: '06:00 PM',
      actualLogoutTime: latestEarlyRecord?.last_punch || '—',
    }
  }, [employee])

  const buildEmailRecord = (record: any) => {
    if (!record || typeof record !== 'object') return null

    const attendanceDate = String(record.attendance_date || record.date || '').trim()
    const fallbackShift = currentShift && currentShift !== 'Not assigned' ? currentShift : record.shift_type || record.shift_name || undefined
    const employeeRecordId = String(employee?.employee_id || record.employee_id || employeeId || '').trim()
    const employeeRecordName = String(employee?.employee_name || record.employee_name || 'Employee').trim()

    return {
      ...record,
      employee_id: employeeRecordId || undefined,
      employee_name: employeeRecordName || undefined,
      attendance_date: attendanceDate || undefined,
      date: attendanceDate || record.date || undefined,
      shift_type: record.shift_type || record.shift_name || fallbackShift,
      shift_name: record.shift_name || record.shift_type || fallbackShift,
    }
  }

  const sendEmail = async (type: 'monthly' | 'late' | 'early') => {
    if (!employee) return

    const now = new Date()
    const month = now.getMonth() + 1
    const year = now.getFullYear()

    try {
      setSendingType(type)
      setFeedback(null)
      if (type === 'monthly') {
        const firstRecord = Array.isArray(employee.records) && employee.records.length > 0 ? buildEmailRecord(employee.records[0]) : null
        await sendMonthlyReportEmail({
          employee_id: employee.employee_id,
          employee_name: employee.employee_name,
          recipient_email: recipientEmail,
          month,
          year,
          attendance_date: `${year}-${String(month).padStart(2, '0')}-01`,
          record: firstRecord,
          assignment: { shift_type: currentShift },
        })
      } else if (type === 'late') {
        const lateRecord = buildEmailRecord(latestLateRecord)
        await sendLateLoginAlertEmail({
          employee_id: employee.employee_id,
          employee_name: employee.employee_name,
          recipient_email: recipientEmail,
          attendance_date: lateRecord?.attendance_date || lateRecord?.date || null,
          record: lateRecord,
          assignment: { shift_type: currentShift, shift_name: currentShift },
        })
      } else {
        const earlyRecord = buildEmailRecord(latestEarlyRecord)
        await sendEarlyLogoutAlertEmail({
          employee_id: employee.employee_id,
          employee_name: employee.employee_name,
          recipient_email: recipientEmail,
          attendance_date: earlyRecord?.attendance_date || earlyRecord?.date || null,
          record: earlyRecord,
          assignment: { shift_type: currentShift, shift_name: currentShift },
        })
      }
      setFeedback({ type: 'success', message: 'Email queued successfully.' })
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to send email.' })
    } finally {
      setSendingType(null)
    }
  }

  const handleLogout = async () => {
    await auth.logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className={collapsed ? 'min-h-screen bg-slate-100 text-slate-900 transition-all duration-300 lg:pl-24' : 'min-h-screen bg-slate-100 text-slate-900 transition-all duration-300 lg:pl-72'}>
      <CEOSidebar collapsed={collapsed} onToggle={() => setCollapsed((prev) => !prev)} />
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-indigo-600">Employee Communication Center</p>
            <h1 className="text-3xl font-bold">Employee Communication Center</h1>
            <p className="text-sm text-slate-600">Manage attendance reports and alerts for this employee.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/ceo/attendance-reports-alerts" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Back to Reports</Link>
            <button onClick={handleLogout} className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">Sign Out</button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
        {feedback ? <div className={`rounded-2xl border p-3 text-sm ${feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{feedback.message}</div> : null}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <p className="text-sm uppercase tracking-[0.25em] text-indigo-600">Employee Information</p>
            <h2 className="text-xl font-semibold">Employee Information</h2>
            <p className="text-sm text-slate-500">Core employee details for this communication profile.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              ['Employee Name', employee?.employee_name || 'Unknown Employee'],
              ['Employee ID', employee?.employee_id || employeeId || 'Unknown ID'],
              ['Email Address', emailAddress],
              ['Current Shift', currentShift],
            ].map(([label, value]) => (
              <article key={String(label)} className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{String(label)}</p>
                <p className="mt-3 text-xl font-bold text-slate-900">{String(value)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <p className="text-sm uppercase tracking-[0.25em] text-indigo-600">Communication Preferences</p>
            <h2 className="text-xl font-semibold">Communication Preferences</h2>
            <p className="text-sm text-slate-500">Current manual/auto settings for monthly reports and alerts.</p>
          </div>
          {loading ? (
            <div className="grid gap-4 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => <article key={`preference-skeleton-${index}`} className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm"><div className="h-4 w-28 animate-pulse rounded bg-slate-200" /><div className="mt-3 h-8 w-full animate-pulse rounded-xl bg-slate-200" /></article>)}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {[
                ['Monthly Report', preferences?.monthly_report_mode || 'manual'],
                ['Late Login Alerts', preferences?.late_login_mode || 'manual'],
                ['Early Logout Alerts', preferences?.early_logout_mode || 'manual'],
              ].map(([label, value]) => (
                <article key={String(label)} className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{String(label)}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${value === 'auto' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{formatMode(String(value))}</span>
                    <span className="text-sm text-slate-500">Read only on this page</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          {[
            {
              key: 'monthly',
              title: 'Monthly Attendance Report',
              accent: 'from-indigo-500 to-indigo-600',
              body: `Employee: ${employee?.employee_name || 'Employee'}\nEmployee ID: ${employee?.employee_id || employeeId || 'N/A'}\nMonth: ${new Date().toLocaleString('en-US', { month: 'long' })}\nYear: ${new Date().getFullYear()}\nCurrent Shift: ${currentShift}\n\nTotal Working Days: ${previewData.totalWorkingDays}\nPresent Days: ${previewData.presentDays}\nAbsent Days: ${previewData.absentDays}\nLate Login Days: ${previewData.lateLoginDays}\nEarly Logout Days: ${previewData.earlyLogoutDays}\nAttendance Percentage: ${previewData.attendancePercentage}%`,
            },
            {
              key: 'late',
              title: 'Late Login Alert',
              accent: 'from-amber-500 to-amber-600',
              body: `Employee: ${employee?.employee_name || 'Employee'}\nShift: ${currentShift}\nLate Login Count: ${previewData.lateLoginDays}\nLatest Late Login Date: ${previewData.latestLateDate}\nExpected Login Time: ${previewData.expectedLoginTime}\nActual Login Time: ${previewData.actualLoginTime}`,
            },
            {
              key: 'early',
              title: 'Early Logout Alert',
              accent: 'from-emerald-500 to-emerald-600',
              body: `Employee: ${employee?.employee_name || 'Employee'}\nShift: ${currentShift}\nEarly Logout Count: ${previewData.earlyLogoutDays}\nLatest Early Logout Date: ${previewData.latestEarlyDate}\nExpected Logout Time: ${previewData.expectedLogoutTime}\nActual Logout Time: ${previewData.actualLogoutTime}`,
            },
          ].map((card) => (
            <article key={card.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] text-indigo-600">Communication Preview</p>
                  <h3 className="mt-2 text-xl font-semibold">{card.title}</h3>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">Live Preview</span>
              </div>
              <div className={`mt-5 rounded-3xl bg-gradient-to-br ${card.accent} p-5 text-white shadow-sm`}>
                <p className="whitespace-pre-line text-sm text-white/95">{card.body}</p>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" disabled={loading} className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100" aria-disabled={loading}>Preview</button>
                <button type="button" disabled={loading || !employee || sendingType !== null} onClick={() => sendEmail(card.key as 'monthly' | 'late' | 'early')} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400">{sendingType === card.key ? 'Sending…' : 'Send Email'}</button>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  )
}
