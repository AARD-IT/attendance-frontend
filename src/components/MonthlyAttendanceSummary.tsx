interface MonthlyAttendanceSummaryProps {
  summary: {
    total_working_days?: number
    present_days?: number
    login_deviation?: number
    logout_deviation?: number
    missing_punches?: number
    total_deviations?: number
    escalations?: number
  }
}

export default function MonthlyAttendanceSummary({ summary }: MonthlyAttendanceSummaryProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-slate-900">Monthly Summary</h2>
        <p className="text-sm text-slate-500">Aggregate attendance totals for the selected month.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ['Total Working Days', summary.total_working_days ?? 0],
          ['Present Days', summary.present_days ?? 0],
          ['Missing Punches', summary.missing_punches ?? 0],
          ['Total Deviations', summary.total_deviations ?? 0],
        ].map(([label, value]) => (
          <article key={String(label)} className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{String(label)}</p>
            <p className="mt-3 text-2xl font-bold text-slate-900">{String(value)}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
