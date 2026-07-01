import type { Shift } from './shiftService'
import { listShifts } from './shiftService'

export interface ShiftRuleView {
  id: string
  label: string
  loginCutoff: string
  logoutCutoff: string
  startTime: string
  endTime: string
}

let cachedRules: ShiftRuleView[] | null = null

function formatDisplayTime(value: string) {
  const text = String(value || '').slice(0, 5)
  const [hours, minutes] = text.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 || 12
  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`
}

function toRuleView(shift: Shift): ShiftRuleView {
  const [sh, sm] = String(shift.start_time).slice(0, 5).split(':').map(Number)
  const [eh, em] = String(shift.end_time).slice(0, 5).split(':').map(Number)
  const loginMinutes = sh * 60 + sm + Number(shift.grace_time_minutes || 0)
  const logoutMinutes = Math.max(0, eh * 60 + em - Number(shift.logout_deviation_minutes || 0))
  const loginCutoff = `${String(Math.floor(loginMinutes / 60) % 24).padStart(2, '0')}:${String(loginMinutes % 60).padStart(2, '0')}`
  const logoutCutoff = `${String(Math.floor(logoutMinutes / 60) % 24).padStart(2, '0')}:${String(logoutMinutes % 60).padStart(2, '0')}`
  return {
    id: String(shift.id),
    label: shift.shift_name,
    loginCutoff: formatDisplayTime(loginCutoff),
    logoutCutoff: formatDisplayTime(logoutCutoff),
    startTime: formatDisplayTime(String(shift.start_time)),
    endTime: formatDisplayTime(String(shift.end_time)),
  }
}

export async function loadShiftRules(forceRefresh = false): Promise<ShiftRuleView[]> {
  if (!forceRefresh && cachedRules) return cachedRules
  try {
    const shifts = await listShifts(false)
    cachedRules = shifts.map(toRuleView)
    return cachedRules
  } catch {
    cachedRules = [
      { id: 'Shift 1', label: 'Shift 1', loginCutoff: '10:35 AM', logoutCutoff: '06:00 PM', startTime: '10:20 AM', endTime: '06:00 PM' },
      { id: 'Shift 2', label: 'Shift 2', loginCutoff: '02:35 PM', logoutCutoff: '10:00 PM', startTime: '02:20 PM', endTime: '10:00 PM' },
    ]
    return cachedRules
  }
}

export function invalidateShiftRulesCache() {
  cachedRules = null
}

export const SHIFT_RULES = [] as ShiftRuleView[]

export default { loadShiftRules, invalidateShiftRulesCache }
