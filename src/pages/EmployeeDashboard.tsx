import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import attendanceService from '../services/attendanceService'
import { formatAttendanceDate, formatPunchTime } from '../utils/time'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

interface AttendanceRecord {
  id: string
  attendance_date: string
  first_punch?: string
  last_punch?: string
  total_hours?: number
  status?: string
}

export default function EmployeeDashboard() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchDashboard = async () => {
      setError('')
      setIsLoading(true)
      try {
        const [dashboardRes, myAttendance] = await Promise.all([
          fetch(`${API_BASE}/api/employee/dashboard`, { headers: { Authorization: `Bearer ${auth.token ?? ''}` } }),
          attendanceService.getMyAttendance(),
        ])
        if (!dashboardRes.ok) throw new Error('Unable to load employee dashboard')
        const dashboardJson = await dashboardRes.json()
        setRecords(myAttendance)
        console.log('Employee dashboard', dashboardJson)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard')
      } finally {
        setIsLoading(false)
      }
    }

    if (auth.token) fetchDashboard()
  }, [auth.token])

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const todayRecord = records.find((entry) => entry.attendance_date === today)
  const monthlyRate = useMemo(() => {
    const present = records.filter((entry) => entry.status === 'PRESENT').length
    return records.length ? Math.round((present / records.length) * 100) : 0
  }, [records])

  const handleLogout = async () => {
    await auth.logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-emerald-600">My Attendance</p>
            <h1 className="text-3xl font-bold">Employee Analytics</h1>
            <p className="text-sm text-slate-600">Daily status, hours worked, and attendance history for your profile.</p>
          </div>
          <button onClick={handleLogout} className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">Sign Out</button>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ['My Attendance %', `${records.length ? Math.round((records.filter((row) => row.status === 'PRESENT').length / records.length) * 100) : 0}%`, 'from-emerald-500 to-emerald-600'],
            ['Today’s Status', todayRecord?.status || 'No record', 'from-sky-500 to-sky-600'],
            ['Today’s Check In', formatPunchTime(todayRecord?.first_punch), 'from-indigo-500 to-indigo-600'],
            ['Working Hours', `${todayRecord?.total_hours ?? 0}h`, 'from-violet-500 to-violet-600'],
          ].map(([label, value, accent]) => (
            <article key={label as string} className={`rounded-3xl bg-gradient-to-br ${accent} p-5 text-white shadow-sm`}>
              <p className="text-xs uppercase tracking-[0.2em] text-white/80">{label as string}</p>
              <p className="mt-3 text-2xl font-bold">{value as string}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Attendance Summary</h2>
            <p className="text-sm text-slate-500">Key indicators for your working pattern.</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs uppercase text-slate-500">Monthly Attendance %</p><p className="text-2xl font-bold text-slate-900">{monthlyRate}%</p></div>
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs uppercase text-slate-500">Today’s Check Out</p><p className="text-2xl font-bold text-slate-900">{formatPunchTime(todayRecord?.last_punch)}</p></div>
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs uppercase text-slate-500">Recent Records</p><p className="text-2xl font-bold text-slate-900">{records.length}</p></div>
            </div>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Recent Attendance Records</h2>
            <p className="text-sm text-slate-500">Your latest attendance history.</p>
            {isLoading ? <div className="mt-4 text-slate-500">Loading…</div> : error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead><tr className="border-b border-slate-200 text-left text-slate-500"><th className="px-3 py-3">Date</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Check In</th><th className="px-3 py-3">Check Out</th><th className="px-3 py-3">Hours</th></tr></thead>
                  <tbody>{records.slice(0, 8).map((row) => <tr key={row.id} className="border-b border-slate-100"><td className="px-3 py-3 text-slate-900">{formatAttendanceDate(row.attendance_date)}</td><td className="px-3 py-3">{row.status || '—'}</td><td className="px-3 py-3">{formatPunchTime(row.first_punch)}</td><td className="px-3 py-3">{formatPunchTime(row.last_punch)}</td><td className="px-3 py-3">{row.total_hours ?? 0}h</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </article>
        </section>
      </main>
    </div>
  )
}
