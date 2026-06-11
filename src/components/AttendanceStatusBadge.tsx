interface AttendanceStatusBadgeProps {
  status?: string
  isLate?: boolean
  isEarlyOut?: boolean
  isMissingPunch?: boolean
}

export default function AttendanceStatusBadge({ status, isLate, isEarlyOut, isMissingPunch }: AttendanceStatusBadgeProps) {
  const normalized = (status || '').toUpperCase()

  if (isMissingPunch || normalized === 'MISSING_PUNCH') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">⚠ Missing Punch</span>
  }

  if (normalized.includes('LATE') && normalized.includes('EARLY')) return <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">Late + Early Out</span>
  if (normalized === 'LATE' || isLate) return <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">Late</span>
  if (normalized === 'EARLY_OUT' || isEarlyOut) return <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700">Early Out</span>

  return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">Present</span>
}
