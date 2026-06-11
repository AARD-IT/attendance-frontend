interface MonthYearFilterProps {
  month: number
  year: number
  onChange: (month: number, year: number) => void
}

export default function MonthYearFilter({ month, year, onChange }: MonthYearFilterProps) {
  const months = Array.from({ length: 12 }, (_, index) => ({ label: new Date(2026, index, 1).toLocaleString('en-US', { month: 'long' }), value: index + 1 }))
  const years = Array.from({ length: 3 }, (_, index) => new Date().getFullYear() - index)

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
      <label className="text-sm font-semibold text-slate-700">Month</label>
      <select
        value={month}
        onChange={(event) => onChange(Number(event.target.value), year)}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
      >
        {months.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
      <label className="text-sm font-semibold text-slate-700">Year</label>
      <select
        value={year}
        onChange={(event) => onChange(month, Number(event.target.value))}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
      >
        {years.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </div>
  )
}
