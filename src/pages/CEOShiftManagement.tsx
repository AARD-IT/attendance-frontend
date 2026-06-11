import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CEOSidebar from '../components/CEOSidebar'
import { useAuth } from '../contexts/AuthContext'
import dashboardService from '../services/dashboardService'
import logo from '../assets/page-logo/logo (1).png'
import { SHIFT_RULES } from '../services/shiftRules'
import shiftManagementService from '../services/shiftManagementService'

interface EmployeeAssignment {
  employee_id: string
  employee_name: string
  employee_email: string
  cc_email: string
  shift_type: string
  effective_from: string
  effective_to: string
}

interface AssignmentRecord {
  id?: string
  employee_id: string
  employee_name: string
  employee_email?: string
  cc_email?: string
  shift_type: string
  effective_from?: string
  effective_to?: string
  start_date?: string
  end_date?: string
  assigned_by?: string
  assigned_at?: string
  created_at?: string
}

export default function CEOShiftManagement() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [employees, setEmployees] = useState<EmployeeAssignment[]>([])
  const [history, setHistory] = useState<AssignmentRecord[]>([])
  const [toast, setToast] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeAssignment | null>(null)
  const [form, setForm] = useState({ employee_email: '', cc_email: '', shift_type: 'Shift 1', effective_from: '', effective_to: '' })

  useEffect(() => {
    const load = async () => {
      if (!auth.token) return
      try {
        const [rows, remote] = await Promise.all([
          dashboardService.getEmployeeAttendanceTable(new Date().getMonth() + 1, new Date().getFullYear()),
          shiftManagementService.getShiftAssignments(),
        ])

        const fallback = JSON.parse(localStorage.getItem('shift-management-assignments') || '[]')
        const assignments = Array.isArray(remote) && remote.length
          ? [...remote, ...fallback.filter((item: any) => !remote.some((entry: any) => String(entry.employee_id) === String(item.employee_id)))]
          : fallback

        const nextRows = rows.map((row: any) => {
          const current = assignments.find((item: any) => String(item.employee_id) === String(row.employee_id)) || {}
          return {
            employee_id: String(row.employee_id || ''),
            employee_name: String(row.employee_name || 'Unknown Employee'),
            employee_email: String(current.employee_email || row.employee_email || ''),
            cc_email: String(current.cc_email || ''),
            shift_type: String(current.shift_type || 'Shift 1'),
            effective_from: String(current.effective_from || ''),
            effective_to: String(current.effective_to || ''),
          }
        })

        setEmployees(nextRows)
        setHistory(Array.isArray(remote) ? remote : fallback)
      } catch {
        const fallback = JSON.parse(localStorage.getItem('shift-management-assignments') || '[]')
        setEmployees([])
        setHistory(fallback)
      }
    }

    load()
  }, [auth.token])

  const shiftCounts = useMemo(() => {
    const assignedShift2 = employees.filter((item) => String(item.shift_type || '').toLowerCase().includes('2')).length
    return { shift1: Math.max(0, employees.length - assignedShift2), shift2: assignedShift2 }
  }, [employees])

  const openModal = (employee: EmployeeAssignment) => {
    setSelectedEmployee(employee)
    setForm({
      employee_email: employee.employee_email,
      cc_email: employee.cc_email,
      shift_type: employee.shift_type || 'Shift 1',
      effective_from: employee.effective_from || new Date().toISOString().slice(0, 10),
      effective_to: employee.effective_to || new Date().toISOString().slice(0, 10),
    })
    setModalOpen(true)
  }

  const refreshAssignments = async () => {
    setIsRefreshing(true)
    try {
      const [rows, remote] = await Promise.all([
        dashboardService.getEmployeeAttendanceTable(new Date().getMonth() + 1, new Date().getFullYear()),
        shiftManagementService.getShiftAssignments({ forceRefresh: true }),
      ])

      const fallback = JSON.parse(localStorage.getItem('shift-management-assignments') || '[]')
      const assignments = Array.isArray(remote) && remote.length
        ? [...remote, ...fallback.filter((item: any) => !remote.some((entry: any) => String(entry.employee_id) === String(item.employee_id)))]
        : fallback

      const nextRows = rows.map((row: any) => {
        const current = assignments.find((item: any) => String(item.employee_id) === String(row.employee_id)) || {}
        return {
          employee_id: String(row.employee_id || ''),
          employee_name: String(row.employee_name || 'Unknown Employee'),
          employee_email: String(current.employee_email || row.employee_email || ''),
          cc_email: String(current.cc_email || ''),
          shift_type: String(current.shift_type || 'Shift 1'),
          effective_from: String(current.effective_from || ''),
          effective_to: String(current.effective_to || ''),
        }
      })

      setEmployees(nextRows)
      setHistory(Array.isArray(remote) ? remote : fallback)
    } catch {
      const fallback = JSON.parse(localStorage.getItem('shift-management-assignments') || '[]')
      setEmployees([])
      setHistory(fallback)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleAssign = async () => {
    if (!selectedEmployee) return
    if (!form.effective_from || !form.effective_to) {
      setToast('Please provide both start and end dates.')
      return
    }

    const start = new Date(form.effective_from)
    const end = new Date(form.effective_to)
    if (start > end) {
      setToast('Start date cannot be later than end date.')
      return
    }

    const overlap = history.some((item) => String(item.employee_id) === String(selectedEmployee.employee_id) && !(end < new Date(item.effective_from || item.start_date || '2099-12-31') || start > new Date(item.effective_to || item.end_date || '1970-01-01')))
    if (overlap) {
      setToast('Employee already has a shift assignment for the selected date range.')
      return
    }

    const payload = {
      employee_id: selectedEmployee.employee_id,
      employee_name: selectedEmployee.employee_name,
      employee_email: form.employee_email,
      cc_email: form.cc_email,
      shift_type: form.shift_type,
      effective_from: form.effective_from,
      effective_to: form.effective_to,
      is_active: true,
      assigned_by: auth.user?.id || 'CEO',
      assigned_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }

    try {
      await shiftManagementService.createShiftAssignment(payload)
    } catch {
      const saved = JSON.parse(localStorage.getItem('shift-management-assignments') || '[]')
      const next = saved.filter((item: any) => String(item.employee_id) !== String(selectedEmployee.employee_id))
      next.push(payload)
      localStorage.setItem('shift-management-assignments', JSON.stringify(next))
    }

    setEmployees((prev) => prev.map((item) => item.employee_id === selectedEmployee.employee_id ? { ...item, ...payload } : item))
    setHistory((prev) => [payload, ...prev])
    setToast(`Successfully assigned ${selectedEmployee.employee_name} to ${form.shift_type} from ${form.effective_from} to ${form.effective_to}.`)
    setModalOpen(false)
    setTimeout(() => setToast(''), 3000)
  }

  const handleDeleteAssignment = async (assignment: AssignmentRecord) => {
    const assignmentLabel = `${assignment.employee_name || 'This employee'} (${assignment.shift_type || 'Shift 1'})`
    if (!window.confirm(`Delete the shift assignment for ${assignmentLabel}? This will remove that override and reset the employee to the default Shift 1 rule for that assignment period.`)) {
      return
    }

    try {
      await shiftManagementService.deleteShiftAssignment(String(assignment.id || ''))
      setHistory((prev) => prev.filter((item) => String(item.id || `${item.employee_id}-${item.effective_from}-${item.effective_to}`) !== String(assignment.id || `${assignment.employee_id}-${assignment.effective_from}-${assignment.effective_to}`)))
      const saved = JSON.parse(localStorage.getItem('shift-management-assignments') || '[]')
      const nextSaved = saved.filter((item: any) => String(item.id || `${item.employee_id}-${item.effective_from}-${item.effective_to}`) !== String(assignment.id || `${assignment.employee_id}-${assignment.effective_from}-${assignment.effective_to}`))
      localStorage.setItem('shift-management-assignments', JSON.stringify(nextSaved))
      setEmployees((prev) => prev.map((item) => item.employee_id === assignment.employee_id ? { ...item, shift_type: 'Shift 1', effective_from: '', effective_to: '' } : item))
      await refreshAssignments()
      setToast(`Deleted the shift assignment for ${assignment.employee_name || 'this employee'}.`)
      setTimeout(() => setToast(''), 3000)
    } catch {
      setToast('Unable to delete the selected shift assignment.')
    }
  }

  const handleDeleteAllAssignments = async () => {
    if (!window.confirm('Delete all shift assignments for every employee? This will reset all overrides to the default Shift 1 behavior.')) {
      return
    }

    try {
      await Promise.all(history.map((item) => shiftManagementService.deleteShiftAssignment(String(item.id || ''))))
      localStorage.setItem('shift-management-assignments', '[]')
      setHistory([])
      setEmployees((prev) => prev.map((item) => ({ ...item, shift_type: 'Shift 1', effective_from: '', effective_to: '' })))
      setToast('All shift assignments were deleted.')
      setTimeout(() => setToast(''), 3000)
    } catch {
      setToast('Unable to delete all shift assignments.')
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
            <p className="text-sm text-slate-600">Manage employee shifts, email routing, attendance policies, and shift assignments from one place.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => refreshAssignments()}
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
        {toast ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{toast}</div> : null}
        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs uppercase tracking-[0.25em] text-indigo-600">Shift overview</p><h2 className="mt-2 text-xl font-semibold">Shift 1</h2><p className="text-sm text-slate-500">10:35 AM – 06:00 PM</p><p className="mt-4 text-sm text-slate-600">Login cutoff: 10:35 • Logout minimum: 18:00</p></article>
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs uppercase tracking-[0.25em] text-indigo-600">Shift overview</p><h2 className="mt-2 text-xl font-semibold">Shift 2</h2><p className="text-sm text-slate-500">02:35 PM – 10:00 PM</p><p className="mt-4 text-sm text-slate-600">Login cutoff: 14:35 • Logout minimum: 22:00</p></article>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-indigo-600">Employee shift table</p>
              <h2 className="text-xl font-semibold">Current assignments</h2>
              <p className="text-sm text-slate-500">Default shift is Shift 1 when no assignment exists.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 px-4 py-3"><p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Shift 1</p><p className="text-xl font-semibold text-slate-900">{shiftCounts.shift1} Employees</p></div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3"><p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Shift 2</p><p className="text-xl font-semibold text-slate-900">{shiftCounts.shift2} Employees</p></div>
            </div>
          </div>
          <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b border-slate-200 text-left text-slate-500"><th className="px-3 py-3">Employee Name</th><th className="px-3 py-3">Email ID</th><th className="px-3 py-3">CC Email</th><th className="px-3 py-3">Current Shift</th><th className="px-3 py-3">Assignment Period</th><th className="px-3 py-3">Edit</th></tr></thead><tbody>{employees.map((employee) => <tr key={employee.employee_id} className="border-b border-slate-100 hover:bg-slate-50 align-top"><td className="px-3 py-3 font-semibold text-slate-900">{employee.employee_name}</td><td className="px-3 py-3 text-slate-600">{employee.employee_email || '—'}</td><td className="px-3 py-3 text-slate-600">{employee.cc_email || '—'}</td><td className="px-3 py-3 text-slate-900">{employee.shift_type || 'Shift 1'}</td><td className="px-3 py-3 text-slate-600">{employee.effective_from && employee.effective_to ? `${employee.effective_from} → ${employee.effective_to}` : 'Default Shift 1'}</td><td className="px-3 py-3"><button onClick={() => openModal(employee)} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">Edit</button></td></tr>)}</tbody></table></div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-indigo-600">Shift assignment history</p>
              <h2 className="mt-2 text-xl font-semibold">Shift Assignment History</h2>
            </div>
            <button type="button" onClick={handleDeleteAllAssignments} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white">Delete All Assigned Shifts</button>
          </div>
          <div className="mt-4 overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b border-slate-200 text-left text-slate-500"><th className="px-3 py-3">Employee</th><th className="px-3 py-3">Shift</th><th className="px-3 py-3">From Date</th><th className="px-3 py-3">To Date</th><th className="px-3 py-3">Assigned By</th><th className="px-3 py-3">Assigned On</th><th className="px-3 py-3">Delete</th></tr></thead><tbody>{history.map((item, index) => <tr key={item.id || `${item.employee_id}-${index}`} className="border-b border-slate-100 hover:bg-slate-50"><td className="px-3 py-3 font-semibold text-slate-900">{item.employee_name}</td><td className="px-3 py-3 text-slate-600">{item.shift_type || 'Shift 1'}</td><td className="px-3 py-3 text-slate-600">{item.effective_from || item.start_date || '—'}</td><td className="px-3 py-3 text-slate-600">{item.effective_to || item.end_date || '—'}</td><td className="px-3 py-3 text-slate-600">{item.assigned_by || 'CEO'}</td><td className="px-3 py-3 text-slate-600">{item.assigned_at || item.created_at || '—'}</td><td className="px-3 py-3"><button type="button" onClick={() => handleDeleteAssignment(item)} className="rounded-xl bg-rose-500 px-3 py-2 text-xs font-semibold text-white">Delete</button></td></tr>)}</tbody></table></div>
        </section>
      </main>

      {modalOpen && selectedEmployee ? <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/40 p-4"><div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"><h3 className="text-xl font-semibold text-slate-900">Assign Shift</h3><p className="text-sm text-slate-500">Update the shift window for {selectedEmployee.employee_name}.</p><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-sm text-slate-700">Employee Email<input type="email" value={form.employee_email} onChange={(e) => setForm((prev) => ({ ...prev, employee_email: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" /></label><label className="text-sm text-slate-700">CC Email<input type="email" value={form.cc_email} onChange={(e) => setForm((prev) => ({ ...prev, cc_email: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" /></label><label className="text-sm text-slate-700">Shift<select value={form.shift_type} onChange={(e) => setForm((prev) => ({ ...prev, shift_type: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">{SHIFT_RULES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="text-sm text-slate-700">Start Date<input type="date" value={form.effective_from} onChange={(e) => setForm((prev) => ({ ...prev, effective_from: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" /></label><label className="text-sm text-slate-700">End Date<input type="date" value={form.effective_to} onChange={(e) => setForm((prev) => ({ ...prev, effective_to: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" /></label></div><div className="mt-6 flex justify-end gap-3"><button onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button><button onClick={handleAssign} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Assign</button></div></div></div> : null}
    </div>
  )
}
