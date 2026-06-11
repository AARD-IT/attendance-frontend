import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import * as XLSX from 'xlsx'
import AttendanceStatusBadge from '../components/AttendanceStatusBadge'
import CEOSidebar from '../components/CEOSidebar'
import EmployeeAttendanceKPIs from '../components/EmployeeAttendanceKPIs'
import MonthYearFilter from '../components/MonthYearFilter'
import MonthlyAttendanceSummary from '../components/MonthlyAttendanceSummary'
import { useAuth } from '../contexts/AuthContext'
import dashboardService from '../services/dashboardService'

interface DetailRecord {
  id: string
  name: string
  date: string
  weekday: string
  first_punch: string
  last_punch: string
  total_time: number
  late: string
  status?: string
  shift_type?: string
  shift_name?: string
  is_missing_punch?: boolean
  is_late?: boolean
  is_early_out?: boolean
}

interface EmployeeDetail {
  employee_id: string
  employee_name: string
  employee_code: string
  average_login: string
  average_logout: string
  average_hours: number
  total_late_count: number
  records: DetailRecord[]
}

interface MonthlyAnalytics {
  month: string
  year: number
  total_working_days: number
  present_days: number
  login_deviation: number
  logout_deviation: number
  missing_punches: number
  total_deviations: number
  escalations: number
  average_login_time: string
  average_logout_time: string
  average_working_hours: string
}

function isLateLogin(row: DetailRecord): boolean {
  return Boolean(row.is_late || /late/i.test(String(row.status || '')))
}

function isEarlyLogout(row: DetailRecord): boolean {
  return Boolean(row.is_early_out || /early/i.test(String(row.status || '')))
}


export default function CEOMployeeDetails() {
  const { id } = useParams()
  const auth = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [data, setData] = useState<EmployeeDetail | null>(null)
  const [analytics, setAnalytics] = useState<MonthlyAnalytics | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [exportScope, setExportScope] = useState<'month' | 'history'>('month')
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx'>('csv')

  useEffect(() => {
    const fetchData = async () => {
      if (!id || !auth.token) return
      setLoading(true)
      setError('')
      try {
        const [detail, monthlyAnalytics] = await Promise.all([
          dashboardService.getEmployeeDetail(id, selectedMonth, selectedYear),
          dashboardService.getEmployeeAttendanceAnalytics(id, selectedMonth, selectedYear),
        ])
        setData(detail as unknown as EmployeeDetail)
        setAnalytics(monthlyAnalytics as unknown as MonthlyAnalytics)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load employee details')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [auth.token, id, selectedMonth, selectedYear])

  const getExportRows = async () => {
    if (!data || !id) return []

    let rows = data.records

    if (exportScope === 'history') {
      const response = await fetch(`${(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')}/api/attendance/?employee_id=${id}&limit=500`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('attendance-dashboard-token') || ''}`,
        },
      })

      if (!response.ok) throw new Error('Failed to load full attendance history')
      const history = await response.json()
      const records = Array.isArray(history?.records) ? history.records : Array.isArray(history) ? history : []

      rows = records.map((record: any) => ({
        id: record.id,
        name: record.employee_name || data.employee_name,
        date: record.attendance_date || '',
        weekday: record.weekday || new Date(record.attendance_date || '').toLocaleDateString('en-US', { weekday: 'long' }),
        first_punch: record.first_punch || '—',
        last_punch: record.last_punch || '—',
        total_time: Number(record.total_hours || 0),
        status: record.status || '',
        is_missing_punch: Boolean(record.status && /missing/i.test(record.status)),
        is_late: Boolean(record.status && /late/i.test(record.status)),
        is_early_out: Boolean(record.status && /early/i.test(record.status)),
      }))
    }

    return rows
  }

  const downloadExport = async () => {
    if (!data || !id) return

    try {
      const rows = await getExportRows()

      const normalizedRows = rows.map((row: any) => ({
        employeeName: row.name || data.employee_name,
        employeeId: data.employee_code,
        date: row.date,
        weekday: row.weekday,
        firstPunch: row.first_punch || '—',
        lastPunch: row.last_punch || '—',
        hours: Number(row.total_time || 0).toFixed(2),
        status: row.status || 'Unknown',
        isLate: row.is_late || /late/i.test(String(row.status || '')),
        isEarlyOut: row.is_early_out || /early/i.test(String(row.status || '')),
        isMissingPunch: row.is_missing_punch || /missing/i.test(String(row.status || '')),
      }))

      if (exportFormat === 'csv') {
        const csvRows = [
          ['Employee Name', 'Employee ID', 'Date', 'Weekday', 'First Punch', 'Last Punch', 'Hours', 'Status', 'Is Late', 'Is Early Out', 'Is Missing Punch'],
          ...normalizedRows.map((row) => [row.employeeName, row.employeeId, row.date, row.weekday, row.firstPunch, row.lastPunch, row.hours, row.status, row.isLate ? 'Yes' : 'No', row.isEarlyOut ? 'Yes' : 'No', row.isMissingPunch ? 'Yes' : 'No']),
        ]

        const csvContent = csvRows.map((entry) => entry.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = exportScope === 'month' ? `employee-${data.employee_code || id}-attendance-${selectedYear}-${String(selectedMonth).padStart(2, '0')}.csv` : `employee-${data.employee_code || id}-full-history.csv`
        link.click()
        URL.revokeObjectURL(url)
      } else {
        const workbook = XLSX.utils.book_new()
        const worksheet = XLSX.utils.aoa_to_sheet([
          ['Employee Name', 'Employee ID', 'Date', 'Weekday', 'First Punch', 'Last Punch', 'Hours', 'Status', 'Late Login', 'Early Logout', 'Missing Punch'],
          ...normalizedRows.map((row) => [row.employeeName, row.employeeId, row.date, row.weekday, row.firstPunch, row.lastPunch, row.hours, row.status, row.isLate ? 'Yes' : 'No', row.isEarlyOut ? 'Yes' : 'No', row.isMissingPunch ? 'Yes' : 'No']),
        ])

        const boldHeader = { font: { bold: true }, fill: { patternType: 'solid', fgColor: { rgb: 'FFDCE6F1' } }, alignment: { vertical: 'center' } }
        const lateFill = { fill: { patternType: 'solid', fgColor: { rgb: 'FFFFE2E2' }, bgColor: { rgb: 'FFFFE2E2' } }, font: { color: { rgb: 'FFB91C1C' }, bold: true } }
        const earlyFill = { fill: { patternType: 'solid', fgColor: { rgb: 'FFFFEDD5' }, bgColor: { rgb: 'FFFFEDD5' } }, font: { color: { rgb: 'FFC2410C' }, bold: true } }
        const missingFill = { fill: { patternType: 'solid', fgColor: { rgb: 'FFFFF3C7' }, bgColor: { rgb: 'FFFFF3C7' } }, font: { color: { rgb: 'FFA16207' }, bold: true } }
        const punchLateFill = { fill: { patternType: 'solid', fgColor: { rgb: 'FFFFA5A5' }, bgColor: { rgb: 'FFFFA5A5' } }, font: { color: { rgb: 'FF991B1B' }, bold: true } }
        const punchEarlyFill = { fill: { patternType: 'solid', fgColor: { rgb: 'FFFFD7AA' }, bgColor: { rgb: 'FFFFD7AA' } }, font: { color: { rgb: 'FF9A5B00' }, bold: true } }
        const punchMissingFill = { fill: { patternType: 'solid', fgColor: { rgb: 'FFFFF08A' }, bgColor: { rgb: 'FFFFF08A' } }, font: { color: { rgb: 'FF854D0E' }, bold: true } }

        for (let c = 0; c < 11; c += 1) {
          const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c })]
          if (cell) cell.s = boldHeader
        }

        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
        for (let r = 1; r <= range.e.r; r += 1) {
          const row = normalizedRows[r - 1]
          const statusCell = worksheet[XLSX.utils.encode_cell({ r, c: 7 })]
          if (statusCell) {
            if (row.isLate) statusCell.s = lateFill
            else if (row.isEarlyOut) statusCell.s = earlyFill
            else if (row.isMissingPunch) statusCell.s = missingFill
          }
          const firstPunchCell = worksheet[XLSX.utils.encode_cell({ r, c: 4 })]
          const lastPunchCell = worksheet[XLSX.utils.encode_cell({ r, c: 5 })]

          if (row.isLate && firstPunchCell) {
            firstPunchCell.s = punchLateFill
          }
          if (row.isEarlyOut && lastPunchCell) {
            lastPunchCell.s = punchEarlyFill
          }
          if (row.isMissingPunch) {
            if (firstPunchCell) firstPunchCell.s = punchMissingFill
            if (lastPunchCell) lastPunchCell.s = punchMissingFill
            const lateFlagCell = worksheet[XLSX.utils.encode_cell({ r, c: 8 })]
            const earlyFlagCell = worksheet[XLSX.utils.encode_cell({ r, c: 9 })]
            const missingFlagCell = worksheet[XLSX.utils.encode_cell({ r, c: 10 })]
            if (lateFlagCell) lateFlagCell.s = missingFill
            if (earlyFlagCell) earlyFlagCell.s = missingFill
            if (missingFlagCell) missingFlagCell.s = missingFill
          }

          if (row.isLate) {
            const lateCell = worksheet[XLSX.utils.encode_cell({ r, c: 8 })]
            if (lateCell) lateCell.s = lateFill
          }
          if (row.isEarlyOut) {
            const earlyCell = worksheet[XLSX.utils.encode_cell({ r, c: 9 })]
            if (earlyCell) earlyCell.s = earlyFill
          }
          if (row.isMissingPunch) {
            const missingCell = worksheet[XLSX.utils.encode_cell({ r, c: 10 })]
            if (missingCell) missingCell.s = missingFill
          }
        }

        worksheet['!cols'] = [
          { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
        ]

        XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Records')

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true })
        const excelBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        const excelUrl = URL.createObjectURL(excelBlob)
        const excelLink = document.createElement('a')
        excelLink.href = excelUrl
        excelLink.download = exportScope === 'month' ? `employee-${data.employee_code || id}-attendance-${selectedYear}-${String(selectedMonth).padStart(2, '0')}.xlsx` : `employee-${data.employee_code || id}-full-history.xlsx`
        excelLink.click()
        URL.revokeObjectURL(excelUrl)
      }

      setIsExportModalOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export attendance report')
      setIsExportModalOpen(false)
    }
  }

  return (
    <div className={collapsed ? 'min-h-screen bg-slate-100 text-slate-900 transition-all duration-300 lg:pl-24' : 'min-h-screen bg-slate-100 text-slate-900 transition-all duration-300 lg:pl-72'}>
      <CEOSidebar collapsed={collapsed} onToggle={() => setCollapsed((prev) => !prev)} />
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-indigo-600">Employee Detail</p>
            <h1 className="text-3xl font-bold">{data?.employee_name || 'Employee Details'}</h1>
            <p className="text-sm text-slate-500">Attendance analytics, monthly filtering, and attendance status badges.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) {
                  navigate(-1)
                } else {
                  navigate('/ceo/employees', { replace: true })
                }
              }}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Back
            </button>
            <Link to="/ceo/dashboard" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Back to CEO Dashboard</Link>
            <button onClick={() => auth.logout().then(() => navigate('/login', { replace: true }))} className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">Sign Out</button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
        {loading ? <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-500">Loading employee details…</div> : data ? (
          <>
            <MonthYearFilter month={selectedMonth} year={selectedYear} onChange={(month, year) => { setSelectedMonth(month); setSelectedYear(year) }} />

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-slate-900">Employee Information</h2>
                <p className="text-sm text-slate-500">Core employee details for the current selection.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                {[
                  ['Employee Name', data.employee_name],
                  ['Employee ID', data.employee_code],
                  ['Average Login', data.average_login],
                  ['Average Logout', data.average_logout],
                ].map(([label, value]) => (
                  <article key={String(label)} className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{String(label)}</p>
                    <p className="mt-3 text-xl font-bold text-slate-900">{String(value)}</p>
                  </article>
                ))}
              </div>
            </section>

            {analytics ? (
              <>
                <EmployeeAttendanceKPIs summary={analytics} totalLateCount={data.total_late_count} averageHours={data.average_hours} />
                <MonthlyAttendanceSummary summary={analytics} />
              </>
            ) : null}

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Attendance Records</h2>
                  <p className="text-sm text-slate-500">Showing records for {new Date(selectedYear, selectedMonth - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })}.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(true)}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
                >
                  Download CSV
                </button>
              </div>
              {data.records.length === 0 ? <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No attendance records found for this month.</div> : <div className="mt-4 overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b border-slate-200 text-left text-slate-500"><th className="px-3 py-3">Date</th><th className="px-3 py-3">Weekday</th><th className="px-3 py-3">Shift</th><th className="px-3 py-3">First Punch</th><th className="px-3 py-3">Last Punch</th><th className="px-3 py-3">Hours</th><th className="px-3 py-3">Status</th></tr></thead><tbody>{data.records.map((row) => {
                const lateLogin = isLateLogin(row)
                const earlyLogout = isEarlyLogout(row)
                const missingPunch = Boolean(row.is_missing_punch || /missing/i.test(String(row.status || '')) || row.total_time <= 0)

                return (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-3 font-semibold text-slate-900">{row.date}</td>
                    <td className="px-3 py-3">{row.weekday}</td>
                    <td className="px-3 py-3 text-slate-700">{row.shift_type || row.shift_name || 'Shift 1'}</td>
                    <td className={`px-3 py-3 ${lateLogin ? 'rounded-xl bg-rose-100 text-rose-800 shadow-sm ring-1 ring-rose-200' : ''}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{row.first_punch || '—'}</span>
                        {lateLogin ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">Late Login</span> : null}
                      </div>
                    </td>
                    <td className={`px-3 py-3 ${earlyLogout ? 'rounded-xl bg-amber-100 text-amber-800 shadow-sm ring-1 ring-amber-200' : ''}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{row.last_punch || '—'}</span>
                        {earlyLogout ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Early Logout</span> : null}
                      </div>
                    </td>
                    <td className={`px-3 py-3 ${missingPunch ? 'bg-amber-50 text-amber-800' : ''}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{row.total_time.toFixed(2)}h</span>
                        {missingPunch ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Missing Punch</span> : null}
                      </div>
                    </td>
                    <td className="px-3 py-3"><AttendanceStatusBadge status={row.status} isLate={row.is_late} isEarlyOut={row.is_early_out} isMissingPunch={row.is_missing_punch} /></td>
                  </tr>
                )
              })}</tbody></table></div>}
            </section>
          </>
        ) : null}

        {isExportModalOpen ? (
          <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/40 p-4">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
              <h3 className="text-xl font-semibold text-slate-900">Download Attendance Data</h3>
              <p className="mt-1 text-sm text-slate-500">Choose export type for this employee’s attendance records.</p>

              <div className="mt-5 space-y-3 text-sm text-slate-700">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Export format</p>
                  <div className="mt-3 grid gap-2">
                    {['csv', 'xlsx'].map((value) => (
                      <label key={value} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:bg-slate-50">
                        <input type="radio" name="export-format" checked={exportFormat === value} onChange={() => setExportFormat(value as 'csv' | 'xlsx')} className="h-4 w-4 text-indigo-600" />
                        <span>
                          <span className="block font-semibold text-slate-900">{value.toUpperCase()} Export</span>
                          <span className="text-slate-500">{value === 'csv' ? 'Standard CSV report with the same data structure.' : 'Excel report with highlighted deviation labels and dashboard-style visuals.'}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-3 hover:bg-slate-50">
                  <input type="radio" name="export-scope" checked={exportScope === 'month'} onChange={() => setExportScope('month')} className="mt-1 h-4 w-4 text-indigo-600" />
                  <span>
                    <span className="block font-semibold text-slate-900">Download Current Filtered Month</span>
                    <span className="text-slate-500">Export only the records currently visible for {new Date(selectedYear, selectedMonth - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })}.</span>
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-3 hover:bg-slate-50">
                  <input type="radio" name="export-scope" checked={exportScope === 'history'} onChange={() => setExportScope('history')} className="mt-1 h-4 w-4 text-indigo-600" />
                  <span>
                    <span className="block font-semibold text-slate-900">Download Full Employee History</span>
                    <span className="text-slate-500">Ignore the current month filter and export every attendance record available for this employee.</span>
                  </span>
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setIsExportModalOpen(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
                <button type="button" onClick={downloadExport} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Download</button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}
