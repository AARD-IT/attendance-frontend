export function normalizeShiftType(value: string | null | undefined) {
  const text = String(value || 'Shift 1').trim().toLowerCase().replace(/[_-]/g, ' ')
  if (/(^|\s)2($|\s)/.test(text) || text === 'two') return 'Shift 2'
  return 'Shift 1'
}

export function overlapsMonth(assignment: any, month: number, year: number) {
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999)
  const effectiveFrom = assignment?.effective_from ? new Date(assignment.effective_from) : null
  const effectiveTo = assignment?.effective_to ? new Date(assignment.effective_to) : null

  return (!effectiveFrom || effectiveFrom <= monthEnd) && (!effectiveTo || effectiveTo >= monthStart)
}

export function resolveEffectiveShift(assignments: any[], employeeId: string, employeeName: string, attendanceDate?: string) {
  const targetDate = attendanceDate ? new Date(attendanceDate) : null
  const candidates = assignments.filter((assignment) => {
    const sameEmployee = String(assignment.employee_id || '').toLowerCase() === String(employeeId || '').toLowerCase() || String(assignment.employee_name || '').toLowerCase() === String(employeeName || '').toLowerCase()
    if (!sameEmployee) return false
    if (!assignment.is_active && assignment.is_active !== undefined) return false

    const effectiveFrom = assignment.effective_from ? new Date(assignment.effective_from) : null
    const effectiveTo = assignment.effective_to ? new Date(assignment.effective_to) : null

    if (targetDate) {
      return (!effectiveFrom || effectiveFrom <= targetDate) && (!effectiveTo || effectiveTo >= targetDate)
    }

    return true
  })

  if (!candidates.length) return 'Shift 1'
  const latest = candidates.sort((a, b) => new Date(b.effective_from || 0).getTime() - new Date(a.effective_from || 0).getTime())[0]
  return normalizeShiftType(latest.shift_type || 'Shift 1')
}

export function getMonthAwareAssignments(assignments: any[], month: number, year: number) {
  return assignments.filter((assignment) => overlapsMonth(assignment, month, year))
}
