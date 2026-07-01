import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CEOSidebar from '../components/CEOSidebar'
import { useAuth } from '../contexts/AuthContext'
import dashboardService from '../services/dashboardService'
import logo from '../assets/page-logo/logo (1).png'
import shiftManagementService from '../services/shiftManagementService'
import shiftService, { type Shift, type ShiftPayload, computeAllowedLogin, computeMinimumLogout, formatTime } from '../services/shiftService'

interface AssignmentRecord {
  id?: string
  employee_id: string
  employee_name: string
  employee_email?: string
  cc_email?: string
  shift_id?: string
  shift_type?: string
  shift_name?: string
  start_date?: string
  end_date?: string
  effective_from?: string
  effective_to?: string
  status?: boolean
  assigned_by?: string
  assigned_at?: string
  created_at?: string
  shift?: Shift
}

interface HistoryRecord {
  id: string
  employee_id: string
  old_shift_id?: string
  new_shift_id?: string
  old_shift_name?: string
  new_shift_name?: string
  effective_date: string
  changed_by?: string
  changed_at: string
  reason?: string
}

const emptyShiftForm: ShiftPayload = {
  shift_name: '',
  start_time: '09:00',
  end_time: '18:00',
  grace_time_minutes: 15,
  minimum_working_hours: 8,
  login_deviation_minutes: 15,
  logout_deviation_minutes: 30,
  status: true,
}

export default function CEOShiftManagement() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([])
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [employees, setEmployees] = useState<{ employee_id: string; employee_name: string }[]>([])
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false)
  const [shiftModalOpen, setShiftModalOpen] = useState(false)
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [editingAssignment, setEditingAssignment] = useState<AssignmentRecord | null>(null)
  const [shiftForm, setShiftForm] = useState<ShiftPayload>(emptyShiftForm)
  const [assignmentForm, setAssignmentForm] = useState({
    employee_id: '',
    employee_name: '',
    employee_email: '',
    cc_email: '',
    shift_id: '',
    start_date: '',
    end_date: '',
    reason: '',
  })
  const [historyFilter, setHistoryFilter] = useState({ employee_id: '', shift_id: '', from_date: '', to_date: '' })
  const [search, setSearch] = useState('')

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3500)
  }

  const loadData = useCallback(async (forceRefresh = false) => {
    if (!auth.token) return
    try {
      const [shiftRows, assignmentRows, historyRows, employeeRows] = await Promise.all([
        shiftService.listShifts(false),
        shiftManagementService.getShiftAssignments({ forceRefresh }),
        shiftService.getShiftHistory(),
        dashboardService.getEmployeeAttendanceTable(new Date().getMonth() + 1, new Date().getFullYear()),
      ])
      setShifts(shiftRows)
      setAssignments(Array.isArray(assignmentRows) ? assignmentRows : [])
      setHistory(Array.isArray(historyRows) ? historyRows : [])
      setEmployees(
        (employeeRows as any[]).map((row) => ({
          employee_id: String(row.employee_id || ''),
          employee_name: String(row.employee_name || 'Unknown Employee'),
        })),
      )
    } catch {
      showToast('error', 'Failed to load shift management data.')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [auth.token])

  useEffect(() => {
    loadData()
  }, [loadData])

  const activeShifts = useMemo(() => shifts.filter((shift) => shift.status !== false), [shifts])

  const filteredAssignments = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return assignments
    return assignments.filter((item) =>
      [item.employee_name, item.employee_email, item.shift_name, item.shift_type]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    )
  }, [assignments, search])

  const shiftUsage = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const shift of shifts) counts[String(shift.id)] = 0
    for (const item of assignments) {
      const key = String(item.shift_id || item.shift?.id || '')
      if (key) counts[key] = (counts[key] || 0) + 1
    }
    return counts
  }, [assignments, shifts])

  const openCreateShift = () => {
    setEditingShift(null)
    setShiftForm(emptyShiftForm)
    setShiftModalOpen(true)
  }

  const openEditShift = (shift: Shift) => {
    setEditingShift(shift)
    setShiftForm({
      shift_name: shift.shift_name,
      start_time: String(shift.start_time).slice(0, 5),
      end_time: String(shift.end_time).slice(0, 5),
      grace_time_minutes: shift.grace_time_minutes,
      minimum_working_hours: Number(shift.minimum_working_hours),
      login_deviation_minutes: shift.login_deviation_minutes,
      logout_deviation_minutes: shift.logout_deviation_minutes,
      status: shift.status !== false,
    })
    setShiftModalOpen(true)
  }

  const handleSaveShift = async () => {
    if (!shiftForm.shift_name.trim()) {
      showToast('error', 'Shift name is required.')
      return
    }
    try {
      if (editingShift) {
        await shiftService.updateShift(editingShift.id, shiftForm)
        showToast('success', 'Shift updated successfully.')
      } else {
        await shiftService.createShift(shiftForm)
        showToast('success', 'Shift created successfully.')
      }
      setShiftModalOpen(false)
      await loadData(true)
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Unable to save shift.')
    }
  }

  const handleToggleShiftStatus = async (shift: Shift) => {
    try {
      await shiftService.updateShift(shift.id, { status: !shift.status })
      showToast('success', shift.status ? 'Shift deactivated.' : 'Shift activated.')
      await loadData(true)
    } catch {
      showToast('error', 'Unable to update shift status.')
    }
  }

  const handleDeleteShift = async (shift: Shift) => {
    if (!window.confirm(`Delete shift "${shift.shift_name}"?`)) return
    try {
      await shiftService.deleteShift(shift.id)
      showToast('success', 'Shift deleted.')
      await loadData(true)
    } catch {
      showToast('error', 'Unable to delete shift.')
    }
  }

  const openAssignmentModal = (assignment?: AssignmentRecord) => {
    if (assignment) {
      setEditingAssignment(assignment)
      setAssignmentForm({
        employee_id: assignment.employee_id,
        employee_name: assignment.employee_name,
        employee_email: assignment.employee_email || '',
        cc_email: assignment.cc_email || '',
        shift_id: String(assignment.shift_id || assignment.shift?.id || activeShifts[0]?.id || ''),
        start_date: assignment.start_date || assignment.effective_from || '',
        end_date: assignment.end_date || assignment.effective_to || '',
        reason: '',
      })
    } else {
      const firstEmployee = employees[0]
      setEditingAssignment(null)
      setAssignmentForm({
        employee_id: firstEmployee?.employee_id || '',
        employee_name: firstEmployee?.employee_name || '',
        employee_email: '',
        cc_email: '',
        shift_id: String(activeShifts[0]?.id || ''),
        start_date: new Date().toISOString().slice(0, 10),
        end_date: new Date().toISOString().slice(0, 10),
        reason: '',
      })
    }
    setAssignmentModalOpen(true)
  }

  const handleSaveAssignment = async () => {
    const start = new Date(assignmentForm.start_date)
    const end = new Date(assignmentForm.end_date)
    if (!assignmentForm.employee_id || !assignmentForm.shift_id || !assignmentForm.start_date || !assignmentForm.end_date) {
      showToast('error', 'Employee, shift, and date range are required.')
      return
    }
    if (start > end) {
      showToast('error', 'Start date cannot be later than end date.')
      return
    }

    const selectedShift = shifts.find((item) => String(item.id) === String(assignmentForm.shift_id))
    const payload = {
      employee_id: assignmentForm.employee_id,
      employee_name: assignmentForm.employee_name,
      employee_email: assignmentForm.employee_email,
      cc_email: assignmentForm.cc_email,
      shift_id: assignmentForm.shift_id,
      shift_type: selectedShift?.shift_name,
      start_date: assignmentForm.start_date,
      end_date: assignmentForm.end_date,
      effective_from: assignmentForm.start_date,
      effective_to: assignmentForm.end_date,
      status: true,
      reason: assignmentForm.reason || (editingAssignment ? 'Shift reassigned' : 'Shift assigned'),
    }

    try {
      if (editingAssignment?.id) {
        await shiftManagementService.updateShiftAssignment(String(editingAssignment.id), payload)
        showToast('success', 'Assignment updated successfully.')
      } else {
        await shiftManagementService.createShiftAssignment(payload)
        showToast('success', 'Assignment created successfully.')
      }
      setAssignmentModalOpen(false)
      await loadData(true)
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Unable to save assignment.')
    }
  }

  const handleDeleteAssignment = async (assignment: AssignmentRecord) => {
    if (!window.confirm(`Remove shift assignment for ${assignment.employee_name}?`)) return
    try {
      await shiftManagementService.deleteShiftAssignment(String(assignment.id || ''))
      showToast('success', 'Assignment removed.')
      await loadData(true)
    } catch {
      showToast('error', 'Unable to remove assignment.')
    }
  }

  const refreshHistory = async () => {
    try {
      const rows = await shiftService.getShiftHistory({
        employee_id: historyFilter.employee_id || undefined,
        shift_id: historyFilter.shift_id || undefined,
        from_date: historyFilter.from_date || undefined,
        to_date: historyFilter.to_date || undefined,
      })
      setHistory(Array.isArray(rows) ? rows : [])
    } catch {
      showToast('error', 'Unable to load shift history.')
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
            <div className="mb-2 flex items-center gap-3">
              <img src={logo} alt="Analytics Avenue logo" className="h-10 w-10 object-contain" />
              <span className="text-lg font-extrabold tracking-tight sm:text-xl"><span className="text-[#1C3D76]">Analytics</span><span className="text-[#080808]"> Avenue</span></span>
            </div>
            <h1 className="text-3xl font-bold">Shift Management</h1>
            <p className="text-sm text-slate-600">Configure dynamic shift rules, assign employees, and review assignment history.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => { setIsRefreshing(true); loadData(true) }} disabled={isRefreshing} className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-70">
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            <button onClick={handleLogout} className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">Sign Out</button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        {toast ? (
          <div className={`rounded-2xl border p-3 text-sm ${toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
            {toast.message}
          </div>
        ) : null}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-indigo-600">Shift master</p>
              <h2 className="text-xl font-semibold">Dynamic shift configuration</h2>
            </div>
            <button type="button" onClick={openCreateShift} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Create Shift</button>
          </div>
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2].map((item) => <div key={item} className="h-36 animate-pulse rounded-2xl bg-slate-100" />)}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {shifts.map((shift) => (
                <article key={shift.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-indigo-600">{shift.status ? 'Active' : 'Inactive'}</p>
                      <h3 className="mt-1 text-lg font-semibold text-slate-900">{shift.shift_name}</h3>
                      <p className="text-sm text-slate-500">{formatTime(shift.start_time)} – {formatTime(shift.end_time)}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">{shiftUsage[String(shift.id)] || 0} assigned</span>
                  </div>
                  <div className="mt-4 space-y-1 text-sm text-slate-600">
                    <p>Allowed login: {computeAllowedLogin(shift)}</p>
                    <p>Minimum logout: {computeMinimumLogout(shift)}</p>
                    <p>Grace: {shift.grace_time_minutes} min • Min hours: {shift.minimum_working_hours}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => openEditShift(shift)} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">Edit</button>
                    <button type="button" onClick={() => handleToggleShiftStatus(shift)} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">{shift.status ? 'Deactivate' : 'Activate'}</button>
                    <button type="button" onClick={() => handleDeleteShift(shift)} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">Delete</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-indigo-600">Active assignments</p>
              <h2 className="text-xl font-semibold">Employee shift assignments</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee or shift" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
              <button type="button" onClick={() => openAssignmentModal()} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Assign Shift</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="px-3 py-3">Employee</th>
                  <th className="px-3 py-3">Shift</th>
                  <th className="px-3 py-3">Start Date</th>
                  <th className="px-3 py-3">End Date</th>
                  <th className="px-3 py-3">Assigned By</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssignments.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">No shift assignments found.</td></tr>
                ) : filteredAssignments.map((item) => (
                  <tr key={item.id || `${item.employee_id}-${item.start_date}`} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-3 font-semibold text-slate-900">{item.employee_name}</td>
                    <td className="px-3 py-3 text-slate-600">{item.shift?.shift_name || item.shift_name || item.shift_type || '—'}</td>
                    <td className="px-3 py-3 text-slate-600">{item.start_date || item.effective_from || '—'}</td>
                    <td className="px-3 py-3 text-slate-600">{item.end_date || item.effective_to || '—'}</td>
                    <td className="px-3 py-3 text-slate-600">{item.assigned_by || 'CEO'}</td>
                    <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.status !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{item.status !== false ? 'Active' : 'Inactive'}</span></td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => openAssignmentModal(item)} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white">Edit</button>
                        <button type="button" onClick={() => openAssignmentModal({ ...item, id: undefined } as AssignmentRecord)} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">Reassign</button>
                        <button type="button" onClick={() => handleDeleteAssignment(item)} className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white">Remove</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-indigo-600">Shift history</p>
              <h2 className="text-xl font-semibold">Assignment change log</h2>
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              <select value={historyFilter.employee_id} onChange={(e) => setHistoryFilter((prev) => ({ ...prev, employee_id: e.target.value }))} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <option value="">All employees</option>
                {employees.map((employee) => <option key={employee.employee_id} value={employee.employee_id}>{employee.employee_name}</option>)}
              </select>
              <select value={historyFilter.shift_id} onChange={(e) => setHistoryFilter((prev) => ({ ...prev, shift_id: e.target.value }))} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <option value="">All shifts</option>
                {shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.shift_name}</option>)}
              </select>
              <input type="date" value={historyFilter.from_date} onChange={(e) => setHistoryFilter((prev) => ({ ...prev, from_date: e.target.value }))} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
              <button type="button" onClick={refreshHistory} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Apply Filters</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="px-3 py-3">Employee</th>
                  <th className="px-3 py-3">Old Shift</th>
                  <th className="px-3 py-3">New Shift</th>
                  <th className="px-3 py-3">Effective Date</th>
                  <th className="px-3 py-3">Changed By</th>
                  <th className="px-3 py-3">Changed At</th>
                  <th className="px-3 py-3">Reason</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">No shift history records yet.</td></tr>
                ) : history.map((item) => {
                  const employee = employees.find((row) => String(row.employee_id) === String(item.employee_id))
                  const oldShift = shifts.find((row) => String(row.id) === String(item.old_shift_id))
                  const newShift = shifts.find((row) => String(row.id) === String(item.new_shift_id))
                  return (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-3 font-semibold text-slate-900">{employee?.employee_name || item.employee_id}</td>
                      <td className="px-3 py-3 text-slate-600">{item.old_shift_name || oldShift?.shift_name || '—'}</td>
                      <td className="px-3 py-3 text-slate-600">{item.new_shift_name || newShift?.shift_name || '—'}</td>
                      <td className="px-3 py-3 text-slate-600">{item.effective_date}</td>
                      <td className="px-3 py-3 text-slate-600">{item.changed_by || 'CEO'}</td>
                      <td className="px-3 py-3 text-slate-600">{item.changed_at ? new Date(item.changed_at).toLocaleString() : '—'}</td>
                      <td className="px-3 py-3 text-slate-600">{item.reason || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {shiftModalOpen ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-semibold">{editingShift ? 'Edit Shift' : 'Create Shift'}</h3>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="text-sm text-slate-700 md:col-span-2">Shift Name<input value={shiftForm.shift_name} onChange={(e) => setShiftForm((prev) => ({ ...prev, shift_name: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" /></label>
              <label className="text-sm text-slate-700">Start Time<input type="time" value={shiftForm.start_time} onChange={(e) => setShiftForm((prev) => ({ ...prev, start_time: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" /></label>
              <label className="text-sm text-slate-700">End Time<input type="time" value={shiftForm.end_time} onChange={(e) => setShiftForm((prev) => ({ ...prev, end_time: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" /></label>
              <label className="text-sm text-slate-700">Grace Time (mins)<input type="number" value={shiftForm.grace_time_minutes} onChange={(e) => setShiftForm((prev) => ({ ...prev, grace_time_minutes: Number(e.target.value) }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" /></label>
              <label className="text-sm text-slate-700">Minimum Working Hours<input type="number" step="0.5" value={shiftForm.minimum_working_hours} onChange={(e) => setShiftForm((prev) => ({ ...prev, minimum_working_hours: Number(e.target.value) }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" /></label>
              <label className="text-sm text-slate-700">Login Deviation (mins)<input type="number" value={shiftForm.login_deviation_minutes} onChange={(e) => setShiftForm((prev) => ({ ...prev, login_deviation_minutes: Number(e.target.value) }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" /></label>
              <label className="text-sm text-slate-700">Logout Deviation (mins)<input type="number" value={shiftForm.logout_deviation_minutes} onChange={(e) => setShiftForm((prev) => ({ ...prev, logout_deviation_minutes: Number(e.target.value) }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" /></label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShiftModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
              <button onClick={handleSaveShift} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Save Shift</button>
            </div>
          </div>
        </div>
      ) : null}

      {assignmentModalOpen ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-semibold">{editingAssignment ? 'Edit Assignment' : 'Assign Shift'}</h3>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="text-sm text-slate-700 md:col-span-2">Employee
                <select value={assignmentForm.employee_id} onChange={(e) => {
                  const selected = employees.find((item) => item.employee_id === e.target.value)
                  setAssignmentForm((prev) => ({ ...prev, employee_id: e.target.value, employee_name: selected?.employee_name || '' }))
                }} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  {employees.map((employee) => <option key={employee.employee_id} value={employee.employee_id}>{employee.employee_name}</option>)}
                </select>
              </label>
              <label className="text-sm text-slate-700">Employee Email<input type="email" value={assignmentForm.employee_email} onChange={(e) => setAssignmentForm((prev) => ({ ...prev, employee_email: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" /></label>
              <label className="text-sm text-slate-700">CC Email<input type="email" value={assignmentForm.cc_email} onChange={(e) => setAssignmentForm((prev) => ({ ...prev, cc_email: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" /></label>
              <label className="text-sm text-slate-700">Shift
                <select value={assignmentForm.shift_id} onChange={(e) => setAssignmentForm((prev) => ({ ...prev, shift_id: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  {activeShifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.shift_name}</option>)}
                </select>
              </label>
              <label className="text-sm text-slate-700">Reason<input value={assignmentForm.reason} onChange={(e) => setAssignmentForm((prev) => ({ ...prev, reason: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" /></label>
              <label className="text-sm text-slate-700">Start Date<input type="date" value={assignmentForm.start_date} onChange={(e) => setAssignmentForm((prev) => ({ ...prev, start_date: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" /></label>
              <label className="text-sm text-slate-700">End Date<input type="date" value={assignmentForm.end_date} onChange={(e) => setAssignmentForm((prev) => ({ ...prev, end_date: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" /></label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setAssignmentModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
              <button onClick={handleSaveAssignment} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Save Assignment</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
