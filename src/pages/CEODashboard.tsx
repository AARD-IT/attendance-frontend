import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import AttendanceStatusBadge from '../components/AttendanceStatusBadge'
import CEOSidebar from '../components/CEOSidebar'
import { useAuth } from '../contexts/AuthContext'
import MonthYearFilter from '../components/MonthYearFilter'
import dashboardService from '../services/dashboardService'
import { averageTimeLabel, formatDepartmentName } from '../utils/time'

interface SummaryData {
  total_employees: number
  present_today: number
  absent_today: number
  late_arrivals: number
  attendance_percentage: number
}


interface EmployeeSummary {
  employee_id: string
  employee_name: string
  employee_code: string
  department: string
  average_working_hours: number
  average_login_time: string
  average_logout_time: string
  total_late_count: number
  login_deviation: number
  logout_deviation: number
  escalations: number
}

interface LiveEvent {
  employee_name: string
  date?: string
  check_in?: string
  check_out?: string
  status?: string
  total_hours?: number
}

export default function CEODashboard() {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [tab, setTab] = useState<'dashboard' | 'employees'>(location.pathname === '/ceo/employees' ? 'employees' : 'dashboard')
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [employees, setEmployees] = useState<EmployeeSummary[]>([])
  const [chartEmployees, setChartEmployees] = useState<EmployeeSummary[]>([])
  const [liveFeed, setLiveFeed] = useState<LiveEvent[]>([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshMessage, setRefreshMessage] = useState('')
  const [search, setSearch] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [chartMonth, setChartMonth] = useState(new Date().getMonth() + 1)
  const [chartYear, setChartYear] = useState(new Date().getFullYear())

  useEffect(() => {
    setTab(location.pathname === '/ceo/employees' ? 'employees' : 'dashboard')
  }, [location.pathname])

  const fetchDashboardData = useCallback(async (forceRefresh = false) => {
    if (!auth.token) return

    setError('')
    setIsLoading(true)

    try {
      const [summaryRes, liveRes] = await Promise.all([
        dashboardService.getDashboardSummary(undefined, undefined, { forceRefresh }),
        dashboardService.getLiveAttendanceFeed(undefined, undefined, { forceRefresh }),
      ])

      setSummary(summaryRes)
      setLiveFeed(liveRes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics dashboard')
    } finally {
      setIsLoading(false)
    }
  }, [auth.token])

  const fetchChartData = useCallback(async (forceRefresh = false) => {
    if (!auth.token) return

    try {
      const chartRes = await dashboardService.getEmployeeAttendanceTable(chartMonth, chartYear, { forceRefresh })
      setChartEmployees(chartRes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chart analytics')
    }
  }, [auth.token, chartMonth, chartYear])

  const fetchEmployeeTableData = useCallback(async (forceRefresh = false) => {
    if (!auth.token) return

    try {
      const employeeRes = await dashboardService.getEmployeeAttendanceTable(selectedMonth, selectedYear, { forceRefresh })
      setEmployees(employeeRes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employee table')
    }
  }, [auth.token, selectedMonth, selectedYear])

  useEffect(() => {
    if (auth.token) {
      fetchDashboardData()
      fetchChartData()
      fetchEmployeeTableData()
    }
  }, [auth.token, fetchDashboardData, fetchChartData, fetchEmployeeTableData])

  const displayName = (value: string) => value.split(/\s+/).filter(Boolean).slice(0, 1).join(' ') || 'Unknown Employee'
  const firstNameOnly = (value: string) => displayName(value).replace(/[^A-Za-z\s-]/g, '').trim() || 'Employee'
  const filteredEmployees = useMemo(() => employees.filter((employee) => `${displayName(employee.employee_name)} ${formatDepartmentName(employee.department)}`.toLowerCase().includes(search.toLowerCase())), [employees, search])

  const averageLoginTime = useMemo(() => averageTimeLabel(employees.map((employee) => employee.average_login_time)), [employees])

  const averageLogoutTime = useMemo(() => averageTimeLabel(employees.map((employee) => employee.average_logout_time)), [employees])

  function toMinutes(value?: string | null) {
    if (!value) return 0
    const text = String(value).trim().slice(0, 5)
    const [hours, minutes] = text.split(':').map(Number)
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0
    return hours * 60 + minutes
  }

  function formatMinutes(value: number) {
    const total = Math.max(0, Math.round(value))
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }

  const analyticsChartData = useMemo(() => chartEmployees
    .map((employee) => ({
      name: firstNameOnly(employee.employee_name),
      avgLogin: toMinutes(employee.average_login_time),
      avgLogout: toMinutes(employee.average_logout_time),
      lateCount: employee.total_late_count,
      loginDeviation: employee.login_deviation,
      logoutDeviation: employee.logout_deviation,
      escalations: employee.escalations,
      employee_name: employee.employee_name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name)), [chartEmployees, firstNameOnly])

  const handleLogout = async () => {
    await auth.logout()
    navigate('/login', { replace: true })
  }

  const handleRefresh = async () => {
    if (!auth.token) return

    setIsRefreshing(true)
    setRefreshMessage('')
    setError('')

    try {
      const syncResult = await dashboardService.syncMinervaAll()
      await Promise.all([
        fetchDashboardData(true),
        fetchChartData(true),
        fetchEmployeeTableData(true),
      ])

      if (syncResult?.success) {
        setRefreshMessage('Latest Minerva data synced successfully.')
      } else {
        setRefreshMessage('Refresh completed, but some sync checks returned warnings.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh latest Minerva data')
    } finally {
      setIsRefreshing(false)
    }
  }

  const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const point = payload[0]?.payload
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-lg">
        <p className="font-semibold text-slate-900">{label}</p>
        <p>Average Login Time: {formatMinutes(point.avgLogin)}</p>
        <p>Average Logout Time: {formatMinutes(point.avgLogout)}</p>
        <p>Late Count: {point.lateCount}</p>
        <p>Login Deviations: {point.loginDeviation}</p>
        <p>Logout Deviations: {point.logoutDeviation}</p>
        <p>Escalations: {point.escalations}</p>
      </div>
    )
  }

  const kpiCards = [
    { label: 'Total Employees', value: summary?.total_employees ?? 0, detail: 'Current active employee count', accent: 'from-indigo-500 to-indigo-600' },
    { label: 'Present Today', value: `${summary?.present_today ?? 0} / ${summary?.total_employees ?? employees.length ?? 0}`, detail: 'Present employees in selected month', accent: 'from-emerald-500 to-emerald-600' },
    { label: 'Absent Today', value: `${summary?.absent_today ?? 0} / ${summary?.total_employees ?? employees.length ?? 0}`, detail: 'Attendance gaps in selected month', accent: 'from-rose-500 to-rose-600' },
    { label: 'Late Arrivals', value: `${summary?.late_arrivals ?? 0} / ${summary?.total_employees ?? employees.length ?? 0}`, detail: 'Late login count in selected month', accent: 'from-amber-500 to-amber-600' },
    { label: 'Attendance %', value: `${summary?.attendance_percentage ?? 0}%`, detail: 'Weighted monthly attendance rate', accent: 'from-slate-800 to-slate-900' },
  ]

  return (
    <div className={collapsed ? 'min-h-screen bg-slate-100 text-slate-900 transition-all duration-300 lg:pl-24' : 'min-h-screen bg-slate-100 text-slate-900 transition-all duration-300 lg:pl-72'}>
      <CEOSidebar collapsed={collapsed} onToggle={() => setCollapsed((prev) => !prev)} />
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-indigo-600">Analytics Avenue</p>
            <h1 className="text-3xl font-bold">CEO Attendance Analytics</h1>
            <p className="text-sm text-slate-600">Attendance movement, workload analytics, and employee-level reporting.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isRefreshing ? 'Refreshing…' : 'Refresh Latest Data'}
            </button>
            <button onClick={handleLogout} className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">Sign Out</button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
        {refreshMessage ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{refreshMessage}</div> : null}

        {tab === 'dashboard' ? (
          <>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] text-indigo-600">Executive KPIs</p>
                  <h2 className="text-xl font-semibold">Monthly attendance signal</h2>
                  <p className="text-sm text-slate-500">Showing selected-month attendance metrics for {new Date(selectedYear, selectedMonth - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })}.</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Live</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">{kpiCards.map((card) => (<article key={card.label} className={`rounded-3xl bg-gradient-to-br ${card.accent} p-5 text-white shadow-sm`}>
                <p className="text-[11px] uppercase tracking-[0.25em] text-white/80">{card.label}</p>
                <p className="mt-3 text-3xl font-bold">{card.value}</p>
                <p className="mt-1 text-xs text-white/80">{card.detail}</p>
              </article>))}</div>
            </section>

            <section className="grid gap-6">
              <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.25em] text-indigo-600">Live feed</p>
                    <h3 className="text-xl font-semibold">Attendance feed</h3>
                    <p className="text-sm text-slate-500">Latest live attendance activity.</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{liveFeed.length} records</span>
                </div>
                <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b border-slate-200 text-left text-slate-500"><th className="px-3 py-3">Employee</th><th className="px-3 py-3">Date</th><th className="px-3 py-3">Check In</th><th className="px-3 py-3">Check Out</th><th className="px-3 py-3">Status</th></tr></thead><tbody>{liveFeed.map((item, index) => (<tr key={`${item.employee_name}-${item.date}-${index}`} className="border-b border-slate-100 hover:bg-slate-50"><td className="px-3 py-3"><p className="font-semibold text-slate-900">{firstNameOnly(item.employee_name)}</p></td><td className="px-3 py-3 text-slate-600">{item.date || '—'}</td><td className="px-3 py-3 text-slate-600">{item.check_in || '—'}</td><td className="px-3 py-3 text-slate-600">{item.check_out || '—'}</td><td className="px-3 py-3"><AttendanceStatusBadge status={item.status} isLate={String(item.status || '').toUpperCase().includes('LATE')} isEarlyOut={String(item.status || '').toUpperCase().includes('EARLY')} isMissingPunch={String(item.status || '').toUpperCase().includes('MISSING')} /></td></tr>))}</tbody></table></div>
              </article>

              <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.25em] text-indigo-600">Analytics</p>
                    <h3 className="text-xl font-semibold">Employee attendance analytics</h3>
                    <p className="text-sm text-slate-500">Average login and logout time by employee, grouped for the selected month.</p>
                  </div>
                  <MonthYearFilter month={chartMonth} year={chartYear} onChange={(month, year) => { setChartMonth(month); setChartYear(year) }} />
                </div>
                <div className="h-80">{isLoading ? <div className="flex h-full items-center justify-center text-slate-500">Loading chart…</div> : <ResponsiveContainer width="100%" height="100%"><BarChart data={analyticsChartData} margin={{ top: 12, right: 12, left: 0, bottom: 12 }}><CartesianGrid stroke="#e5e7eb" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={(value) => formatMinutes(value)} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ borderRadius: 16, borderColor: '#e5e7eb' }} formatter={(value: number) => formatMinutes(Number(value))} labelFormatter={(label) => `Employee: ${label}`} /><Bar dataKey="avgLogin" fill="#6366f1" radius={[8, 8, 0, 0]} name="Avg Login Time" /><Bar dataKey="avgLogout" fill="#14b8a6" radius={[8, 8, 0, 0]} name="Avg Logout Time" /></BarChart></ResponsiveContainer>}</div>
                <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">Tooltip highlights employee name, average login/logout time, late count, login deviations, logout deviations, and escalations.</div>
              </article>
            </section>
          </>
        ) : (
          <section className="flex flex-col gap-6">
            <MonthYearFilter month={selectedMonth} year={selectedYear} onChange={(month, year) => { setSelectedMonth(month); setSelectedYear(year) }} />

            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Employee Overview</h2>
              <p className="text-sm text-slate-500">Aggregated employee attendance metrics for {new Date(selectedYear, selectedMonth - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })}.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {[['Total Employees', employees.length], ['Average Login Time', averageLoginTime], ['Average Logout Time', averageLogoutTime]].map(([label, value]) => <div key={label as string} className="rounded-2xl bg-slate-50 p-4"><p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label as string}</p><p className="mt-2 text-2xl font-bold text-slate-900">{String(value)}</p></div>)}
              </div>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Employee Attendance Table</h3>
                  <p className="text-sm text-slate-500">Search by employee name or department and review month-specific analytics.</p>
                </div>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="px-3 py-3">Employee Name</th>
                      <th className="px-3 py-3">Average Working Hours</th>
                      <th className="px-3 py-3">Average Login Time</th>
                      <th className="px-3 py-3">Average Logout Time</th>
                      <th className="px-3 py-3">Total Late Count</th>
                      <th className="px-3 py-3">Login Deviation</th>
                      <th className="px-3 py-3">Logout Deviation</th>
                      <th className="px-3 py-3">Total Escalation</th>
                      <th className="px-3 py-3">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((employee) => (
                      <tr key={employee.employee_id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-3"><p className="font-semibold text-slate-900">{displayName(employee.employee_name)}</p><p className="text-xs text-slate-500">{formatDepartmentName(employee.department)}</p></td>
                        <td className="px-3 py-3">{employee.average_working_hours.toFixed(2)}h</td>
                        <td className="px-3 py-3">{employee.average_login_time}</td>
                        <td className="px-3 py-3">{employee.average_logout_time}</td>
                        <td className="px-3 py-3">{employee.total_late_count}</td>
                        <td className="px-3 py-3">{employee.login_deviation}</td>
                        <td className="px-3 py-3">{employee.logout_deviation}</td>
                        <td className="px-3 py-3">{employee.escalations}</td>
                        <td className="px-3 py-3"><Link to={`/ceo/employees/${employee.employee_id}`} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">Details</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        )}
      </main>
    </div>
  )
}
