interface EmployeeAttendanceKPIsProps {
  summary: {
    average_login_time?: string
    average_logout_time?: string
    average_working_hours?: string | number
    login_deviation?: number
    logout_deviation?: number
    escalations?: number
  }
  totalLateCount?: number
  averageHours?: number
}

export default function EmployeeAttendanceKPIs({ summary, totalLateCount, averageHours }: EmployeeAttendanceKPIsProps) {
  const cards = [
    { label: 'Average Login Time', value: summary.average_login_time || '--' },
    { label: 'Average Logout Time', value: summary.average_logout_time || '--' },
    { label: 'Average Working Hours', value: `${averageHours?.toFixed(2) ?? summary.average_working_hours ?? '0'}h` },
    { label: 'Total Late Count', value: totalLateCount ?? 0 },
    { label: 'Login Deviation', value: summary.login_deviation ?? 0 },
    { label: 'Logout Deviation', value: summary.logout_deviation ?? 0 },
    { label: 'Escalation', value: summary.escalations ?? 0 },
  ]

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Attendance KPI Cards</h2>
          <p className="text-sm text-slate-500">Key attendance metrics for the selected month.</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article key={card.label} className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-white">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{card.label}</p>
            <p className="mt-3 text-2xl font-bold text-slate-900">{String(card.value)}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
