import { Link, useLocation } from 'react-router-dom'
import logo from '../assets/page-logo/logo (1).png'

interface CEOSidebarProps {
  collapsed: boolean
  onToggle: () => void
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
      <path d="M3 12.5 12 4l9 8.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 10.5V20h13V10.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function EmployeesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
      <path d="M16 20v-1.5A3.5 3.5 0 0 0 12.5 15h-1A3.5 3.5 0 0 0 8 18.5V20" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="8.5" r="3" />
      <path d="M18 20v-1.25a2.75 2.75 0 0 0-2.25-2.68" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 20v-1.25a2.75 2.75 0 0 1 2.25-2.68" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ShiftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="8" />
    </svg>
  )
}

function ReportsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
      <path d="M5 4h9l5 5v11H5z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 4v5h5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 13h8M8 17h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function CEOSidebar({ collapsed, onToggle }: CEOSidebarProps) {
  const location = useLocation()
  const isDashboard = location.pathname === '/ceo/dashboard'
  const isEmployees = location.pathname === '/ceo/employees' || location.pathname.startsWith('/ceo/employees/')
  const isShiftManagement = location.pathname === '/ceo/shift-management'
  const isAttendanceReports = location.pathname === '/ceo/attendance-reports-alerts' || location.pathname.startsWith('/ceo/attendance-reports-alerts/')

  const navItems = [
    { label: 'Dashboard', to: '/ceo/dashboard', icon: <DashboardIcon />, active: isDashboard },
    { label: 'Employees', to: '/ceo/employees', icon: <EmployeesIcon />, active: isEmployees },
    { label: 'Shift Management', to: '/ceo/shift-management', icon: <ShiftIcon />, active: isShiftManagement },
    { label: 'Attendance Reports & Alerts', to: '/ceo/attendance-reports-alerts', icon: <ReportsIcon />, active: isAttendanceReports },
  ]

  return (
    <aside className={`fixed inset-y-0 left-0 z-20 hidden border-r border-slate-200 bg-white text-slate-900 transition-all duration-300 lg:block ${collapsed ? 'w-24' : 'w-72'}`}>
      <div className="flex h-full flex-col px-4 py-5">
        <div className="mb-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onToggle}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
              {collapsed ? (
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
          </button>
          {!collapsed ? <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-indigo-600">Menu</span> : null}
        </div>

        <div className="mb-8 flex items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/80">
          <img src={logo} alt="Analytics Avenue logo" className="h-12 w-12 object-contain" />
          {!collapsed ? (
            <div>
              <span className="text-lg font-extrabold tracking-tight sm:text-xl"><span className="text-[#1C3D76]">Analytics</span><span className="text-[#080808]"> Avenue</span></span>
            </div>
          ) : null}
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`group flex items-center ${collapsed ? 'justify-center' : 'justify-between'} rounded-2xl border px-4 py-3 text-sm font-semibold transition ${item.active ? 'border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-100' : 'border-transparent bg-slate-50 text-slate-700 hover:border-slate-200 hover:bg-white'}`}
            >
              <span className="flex items-center gap-3">
                <span className={`rounded-xl p-2 ${item.active ? 'bg-indigo-100 text-indigo-700' : 'bg-white text-slate-500'}`}>{item.icon}</span>
                {!collapsed ? item.label : null}
              </span>
              {!collapsed && item.active ? <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" /> : null}
            </Link>
          ))}
        </nav>

        {!collapsed ? (
          <div className="mt-auto rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Navigation</p>
            <p className="mt-2 text-slate-600">Dashboard and employee views stay available from this fixed sidebar while you browse.</p>
          </div>
        ) : null}
      </div>
    </aside>
  )
}
