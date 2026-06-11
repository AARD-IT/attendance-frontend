/**
 * ============================================================
 * calculateStats.js — Core business-logic layer for EMS
 * ============================================================
 *
 * All functions accept parsed minute-values (or null) — they do
 * NOT parse raw strings.  Call parseTime() from timeUtils before
 * passing values here.
 *
 * "minutes since midnight" is the single internal currency:
 *   08:30  →  510
 *   17:00  →  1020
 * ============================================================
 */

import { timeDifference, safeNum, parseTime } from './timeUtils.js';

// ─── 1. Working Hours ─────────────────────────────────────────────────────────

/**
 * calculateWorkingHours(clockInMin, clockOutMin)
 *
 * Working time = actual time physically in the office.
 *   = Clock Out − Clock In
 *
 * Rules:
 *   • Either value null  → 0 (not null — safe for aggregation)
 *   • Clock Out < Clock In → 0  (bad data / overnight shift guard)
 *   • Same time → 0
 *
 * @returns {number} minutes worked (≥ 0, never NaN)
 */
export function calculateWorkingHours(clockInMin, clockOutMin) {
  const diff = timeDifference(clockInMin, clockOutMin);
  if (diff === null || diff < 0) return 0;
  return diff; // minutes
}

// ─── 2. Late ─────────────────────────────────────────────────────────────────

/**
 * calculateLate(clockInMin, checkInMin)
 *
 * An employee is late when their actual Clock In is AFTER the scheduled Check In.
 *
 *   Late time = Clock In − Check In  (when > 0)
 *
 * Returns:
 *   { isLate: boolean, lateMinutes: number }
 *
 * Edge cases:
 *   • clockInMin null  → { isLate: false, lateMinutes: 0 }
 *     (absence is handled separately by the status logic)
 *   • checkInMin null  → { isLate: false, lateMinutes: 0 }
 *     (no schedule reference — cannot determine late)
 *   • clockIn <= checkIn → { isLate: false, lateMinutes: 0 }
 *
 * @param {number|null} clockInMin   Actual login  (minutes since midnight)
 * @param {number|null} checkInMin   Scheduled login (minutes since midnight)
 * @returns {{ isLate: boolean, lateMinutes: number }}
 */
export function calculateLate(clockInMin, checkInMin) {
  const EMPTY = { isLate: false, lateMinutes: 0 };

  if (clockInMin === null || checkInMin === null) return EMPTY;

  const diff = timeDifference(checkInMin, clockInMin); // clockIn − checkIn
  if (diff === null || diff <= 0) return EMPTY;

  return { isLate: true, lateMinutes: diff };
}

// ─── 3. Early Leave ───────────────────────────────────────────────────────────

/**
 * calculateEarlyLeave(clockOutMin, checkOutMin)
 *
 * An employee left early when their actual Clock Out is BEFORE the scheduled Check Out.
 *
 *   Early leave time = Check Out − Clock Out  (when > 0)
 *
 * Returns:
 *   { isEarlyLeave: boolean, earlyLeaveMinutes: number }
 *
 * Edge cases:
 *   • clockOutMin null  → { isEarlyLeave: false, earlyLeaveMinutes: 0 }
 *   • checkOutMin null  → { isEarlyLeave: false, earlyLeaveMinutes: 0 }
 *   • clockOut >= checkOut → not early
 *
 * @param {number|null} clockOutMin   Actual logout (minutes since midnight)
 * @param {number|null} checkOutMin   Scheduled logout (minutes since midnight)
 * @returns {{ isEarlyLeave: boolean, earlyLeaveMinutes: number }}
 */
export function calculateEarlyLeave(clockOutMin, checkOutMin) {
  const EMPTY = { isEarlyLeave: false, earlyLeaveMinutes: 0 };

  if (clockOutMin === null || checkOutMin === null) return EMPTY;

  const diff = timeDifference(clockOutMin, checkOutMin); // checkOut − clockOut
  if (diff === null || diff <= 0) return EMPTY;

  return { isEarlyLeave: true, earlyLeaveMinutes: diff };
}

// ─── 4. Required Work Check ───────────────────────────────────────────────────

/**
 * calculateRequiredWorkStatus(workingMinutes, requiredWorkMin)
 *
 * @param {number}      workingMinutes   Result of calculateWorkingHours()
 * @param {number|null} requiredWorkMin  Required hours in minutes (from Excel)
 * @returns {'Completed' | 'Underworked' | 'No Schedule'}
 */
export function calculateRequiredWorkStatus(workingMinutes, requiredWorkMin) {
  if (requiredWorkMin === null) return 'No Schedule';
  if (workingMinutes >= requiredWorkMin) return 'Completed';
  return 'Underworked';
}

const DEFAULT_REQUIRED_WORK_MINUTES = 9 * 60;

// ─── 5. Single-row record builder ────────────────────────────────────────────

/**
 * buildDayRecord(rawFields)
 *
 * Given already-parsed minute-values for a single Excel row, computes all
 * derived metrics and returns a fully-typed record object.
 *
 * All fields are guaranteed to be:
 *   • number  (never NaN)
 *   • string  (never undefined)
 *   • null    (explicit "no data" — components handle with '—')
 *   • boolean
 *
 * @param {{
 *   date:         string | null,
 *   weekday:      string,
 *   timetable:    string,
 *   checkIn:      number | null,  // scheduled login  (minutes)
 *   checkOut:     number | null,  // scheduled logout (minutes)
 *   clockIn:      number | null,  // actual    login  (minutes)
 *   clockOut:     number | null,  // actual    logout (minutes)
 *   requiredWork: number | null,  // required work duration (minutes)
 *   totalWT:      number | null,
 *   actualWT:     number | null,
 *   normalWT:     number | null,
 *   weekdayOT:    number | null,
 *   weekOffOT:    number | null,
 *   holidayOT:    number | null,
 *   dutyDuration: number | null,
 *   statusRaw:    string,
 *   absenceRaw:   any,
 *   leaveRaw:     any,
 *   lateRaw:      any,
 *   earlyLeaveRaw:any,
 *   unscheduled:  any,
 *   remaining:    any,
 *   department:   string,
 * }} rawFields
 */
export function buildDayRecord(rawFields) {
  const {
    date, weekday, timetable,
    checkIn, checkOut,
    clockIn, clockOut,
    requiredWork,
    totalWT, actualWT, normalWT,
    weekdayOT, weekOffOT, holidayOT,
    dutyDuration,
    statusRaw, absenceRaw, leaveRaw,
    lateRaw, earlyLeaveRaw,
    unscheduled, remaining,
    department,
  } = rawFields;

  // ── Working hours (clock-based) ──────────────────────────────────────────
  const workingMinutes = calculateWorkingHours(clockIn, clockOut);

  // If clock data is absent, fall back to totalWT / actualWT from the sheet
  // (some systems pre-calculate these). Convert to minutes if they're not already.
  const sheetWT = totalWT ?? actualWT ?? null;
  // workingMinutes from clock always wins; sheetWT is fallback
  const effectiveWorkMinutes = workingMinutes > 0 ? workingMinutes : (sheetWT ?? 0);

  // ── Late / Early Leave ───────────────────────────────────────────────────
  const lateFromSheet = _parseDurationOrNull(lateRaw);
  const earlyFromSheet = _parseDurationOrNull(earlyLeaveRaw);
  const computedLate = calculateLate(clockIn, checkIn);
  const computedEarlyLeave = calculateEarlyLeave(clockOut, checkOut);
  const lateMinutes = lateFromSheet ?? computedLate.lateMinutes;
  const earlyLeaveMinutes = earlyFromSheet ?? computedEarlyLeave.earlyLeaveMinutes;
  const isLate = lateMinutes > 0;
  const isEarlyLeave = earlyLeaveMinutes > 0;

  // ── Required work status ─────────────────────────────────────────────────
  const expectedFromSheet = requiredWork ?? dutyDuration;
  const expectedWorkMinutes = Math.max(expectedFromSheet ?? 0, DEFAULT_REQUIRED_WORK_MINUTES);
  const workRequirement = calculateRequiredWorkStatus(effectiveWorkMinutes, expectedWorkMinutes);

  // ── Status (attendance status for this day) ───────────────────────────────
  const status = resolveStatus({
    statusRaw,
    clockIn,
    clockOut,
    absenceRaw,
    leaveRaw,
    isLate,
  });

  // ── Chart-safe numeric values (never NaN) ─────────────────────────────────
  const clockInHours  = clockIn  !== null ? safeNum(clockIn  / 60) : null;
  const clockOutHours = clockOut !== null ? safeNum(clockOut / 60) : null;
  const workHours     = safeNum(effectiveWorkMinutes / 60);

  return {
    // Identifiers
    date:               date   ?? null,
    weekday:            String(weekday  || ''),
    timetable:          String(timetable || ''),
    department:         String(department || 'N/A'),

    // Schedule (minutes)
    checkIn,
    checkOut,

    // Actuals (minutes)
    clockIn,
    clockOut,

    // Display strings — always "HH:mm" or "--:--"
    clockInStr:         clockIn  !== null ? _fmt(clockIn)  : '--:--',
    clockOutStr:        clockOut !== null ? _fmt(clockOut) : '--:--',
    checkInStr:         checkIn  !== null ? _fmt(checkIn)  : '--:--',
    checkOutStr:        checkOut !== null ? _fmt(checkOut) : '--:--',

    // Working time (minutes)
    workingMinutes:     effectiveWorkMinutes,   // ≥ 0, never NaN

    // Convenience decimal hours — safe for Recharts
    workHours,                                  // ≥ 0, never NaN
    clockInHours,                               // null or number
    clockOutHours,                              // null or number

    // Late
    isLate,
    lateMinutes,                                // 0 if not late

    // Early leave
    isEarlyLeave,
    earlyLeaveMinutes,                          // 0 if not early

    // Required work
    requiredWork:       expectedWorkMinutes,     // minutes
    workRequirement,                            // 'Completed' | 'Underworked' | 'No Schedule'

    // Sheet-provided time columns (minutes | null)
    totalWT,
    actualWT,
    normalWT,
    weekdayOT:          weekdayOT ?? null,
    weekOffOT:          weekOffOT ?? null,
    holidayOT:          holidayOT ?? null,
    dutyDuration:       dutyDuration ?? null,
    unscheduled:        _parseAny(unscheduled),
    remaining:          _parseAny(remaining),

    // Status
    status,
  };
}

// ─── 6. Employee aggregation ──────────────────────────────────────────────────

/**
 * calculateEmployeeStats(employee)
 *
 * Aggregates all records for one employee into a stats object.
 * NULL values are ignored (not counted) in averages.
 *
 * @param {{ records: Array }} employee
 * @returns {{
 *   totalDays:        number,
 *   presentDays:      number,
 *   absentDays:       number,
 *   leaveDays:        number,
 *   lateDays:         number,
 *   earlyLeaveDays:   number,
 *   completedDays:    number,
 *   underworkedDays:  number,
 *   didntLogInDays:   number,
 *   didntLogOutDays:  number,
 *   avgClockIn:       number | null,   minutes since midnight
 *   avgClockOut:      number | null,   minutes since midnight
 *   avgWorkHours:     number | null,   decimal hours
 *   avgLateMinutes:   number,
 *   avgEarlyLeaveMinutes: number,
 *   totalWorkMinutes: number,
 * }}
 */
export function calculateEmployeeStats(employee) {
  const records = employee?.records ?? [];

  let presentDays       = 0;
  let absentDays        = 0;
  let leaveDays         = 0;
  let lateDays          = 0;
  let earlyLeaveDays    = 0;
  let completedDays     = 0;
  let underworkedDays   = 0;
  let didntLogInDays    = 0;
  let didntLogOutDays   = 0;
  let totalWorkMinutes  = 0;

  const clockIns   = []; // minutes
  const clockOuts  = []; // minutes
  const workMins   = []; // minutes per worked day
  const lateMins   = []; // minutes late per late day
  const earlyMins  = []; // minutes early per early day

  for (const r of records) {
    const status = r.status ?? 'Unknown';

    // Count by status
    if (status === 'Absent')   { absentDays++;  continue; } // skip work aggregation
    if (status === 'Holiday')  { continue; }
    if (status === 'Day Off')  { continue; }
    if (status === 'Leave')    { leaveDays++;   continue; }

    presentDays++;

    // In this report type, same in/out punch means punch data is not reliable.
    const hasSamePunchTime = r.clockIn !== null && r.clockOut !== null && r.clockIn === r.clockOut;
    if (r.clockIn === null || hasSamePunchTime) didntLogInDays++;
    if (r.clockOut === null || hasSamePunchTime) didntLogOutDays++;

    // Clock-in / out
    if (r.clockIn  !== null) clockIns.push(r.clockIn);
    if (r.clockOut !== null) clockOuts.push(r.clockOut);

    // Working minutes (always ≥ 0 because buildDayRecord guarantees it)
    const wm = safeNum(r.workingMinutes, 0);
    if (wm > 0) {
      workMins.push(wm);
      totalWorkMinutes += wm;
    }

    // Late
    if (r.isLate) {
      lateDays++;
      lateMins.push(safeNum(r.lateMinutes, 0));
    }

    // Early leave
    if (r.isEarlyLeave) {
      earlyLeaveDays++;
      earlyMins.push(safeNum(r.earlyLeaveMinutes, 0));
    }

    // Required work status
    if (r.workRequirement === 'Completed')   completedDays++;
    if (r.workRequirement === 'Underworked') underworkedDays++;
  }

  return {
    totalDays:            records.length,
    presentDays,
    absentDays,
    leaveDays,
    lateDays,
    earlyLeaveDays,
    completedDays,
    underworkedDays,
    didntLogInDays,
    didntLogOutDays,

    // Averages — null when no data to average
    avgClockIn:           _avg(clockIns),
    avgClockOut:          _avg(clockOuts),
    avgWorkHours:         workMins.length ? _avg(workMins) / 60 : null, // decimal hours
    avgLateMinutes:       lateMins.length ? _avg(lateMins) : 0,
    avgEarlyLeaveMinutes: earlyMins.length ? _avg(earlyMins) : 0,

    totalWorkMinutes,
  };
}

// ─── 7. Chart-ready aggregation helpers ──────────────────────────────────────

/**
 * getDailyAttendanceTrend(employees, dates) → array
 *
 * Returns one data point per date — safe for Recharts (no NaN, no undefined).
 */
export function getDailyAttendanceTrend(employees, dates) {
  const empList = Object.values(employees);
  return dates.map(date => {
    let present = 0, absent = 0, late = 0, leave = 0;

    empList.forEach(emp => {
      const rec = emp.records.find(r => r.date === date);
      if (!rec) return;
      if (rec.status === 'Absent')        { absent++;  return; }
      if (rec.status === 'Leave')         { leave++;   return; }
      if (rec.status === 'Holiday')       { return; }
      if (rec.status === 'Day Off')       { return; }
      if (rec.isLate)                     { late++;    }
      else                                { present++; }
    });

    return {
      date,
      label:   _shortDate(date),
      present: safeNum(present),
      absent:  safeNum(absent),
      late:    safeNum(late),
      leave:   safeNum(leave),
      total:   safeNum(present + absent + late + leave),
    };
  });
}

/**
 * getTopEmployeesByWorkHours(employees, limit) → array
 *
 * Returns top N employees sorted by total working hours.
 * Safe for Recharts.
 */
export function getTopEmployeesByWorkHours(employees, limit = 10) {
  return Object.values(employees)
    .map(emp => {
      const stats = calculateEmployeeStats(emp);
      return {
        name:       (emp.name || '').split(' ')[0],
        fullName:   emp.name || '',
        department: emp.department || '',
        avgHours:   safeNum(stats.avgWorkHours, 0),
        totalHours: safeNum(stats.totalWorkMinutes / 60, 0),
      };
    })
    .sort((a, b) => b.totalHours - a.totalHours)
    .slice(0, limit);
}

/** Minutes since midnight — login strictly after this counts as login deviation */
export const LOGIN_DEVIATION_AFTER_MINUTES = 10 * 60 + 35;

/** Minutes since midnight — logout strictly before this counts as logout deviation */
export const LOGOUT_DEVIATION_BEFORE_MINUTES = 18 * 60;

/**
 * True when this row should be excluded from office-day metrics (matches calculateEmployeeStats).
 * @param {{ status?: string }} r
 */
function _isExcludedOfficeStatus(r) {
  const status = r.status ?? 'Unknown';
  return status === 'Absent' || status === 'Holiday' || status === 'Day Off' || status === 'Leave';
}

function _samePunch(r) {
  return r.clockIn !== null && r.clockOut !== null && r.clockIn === r.clockOut;
}

/**
 * Per-employee report metrics aligned with First & Last style exports:
 * days in office, deviation counts (login after 10:35, logout before 18:00),
 * incomplete punch days, and base stats from calculateEmployeeStats.
 *
 * @param {{ id?: string, name?: string, records?: Array }} employee
 * @returns {{
 *   daysInOffice: number,
 *   loginDeviation: number,
 *   logoutDeviation: number,
 *   didntLogBoth: number,
 *   stats: ReturnType<typeof calculateEmployeeStats>,
 * }}
 */
export function computeReportMetrics(employee) {
  const stats = calculateEmployeeStats(employee);
  const records = employee?.records ?? [];

  let daysInOffice = 0;
  let loginDeviation = 0;
  let logoutDeviation = 0;
  let didntLogBoth = 0;

  for (const r of records) {
    if (_isExcludedOfficeStatus(r)) continue;

    daysInOffice++;

    const same = _samePunch(r);
    const hasIn = r.clockIn !== null && !same;
    const hasOut = r.clockOut !== null && !same;

    if (!hasIn || !hasOut) didntLogBoth++;

    if (hasIn && r.clockIn > LOGIN_DEVIATION_AFTER_MINUTES) loginDeviation++;
    if (hasOut && r.clockOut < LOGOUT_DEVIATION_BEFORE_MINUTES) logoutDeviation++;
  }

  return {
    daysInOffice,
    loginDeviation,
    logoutDeviation,
    didntLogBoth,
    stats,
  };
}

/**
 * Rank 1 = earliest average login. Employees with no avg login are unranked (null).
 *
 * @param {Record<string, { id?: string, name?: string, records?: Array }>} employees
 * @returns {Record<string, number | null>} key = employee id or name
 */
export function computeLoginRanks(employees) {
  const list = Object.values(employees || {})
    .map(emp => {
      const st = calculateEmployeeStats(emp);
      const key = String(emp.id || '').trim() || String(emp.name || '').trim();
      return { key, avgIn: st.avgClockIn };
    })
    .filter(e => e.key);

  const withAvg = list.filter(e => e.avgIn !== null).sort((a, b) => a.avgIn - b.avgIn);
  /** @type {Record<string, number | null>} */
  const ranks = {};
  for (const e of list) ranks[e.key] = null;
  withAvg.forEach((e, i) => {
    ranks[e.key] = i + 1;
  });
  return ranks;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function _avg(arr) {
  if (!arr.length) return null;
  const sum = arr.reduce((a, b) => a + b, 0);
  return sum / arr.length;
}

function _fmt(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function _shortDate(dateStr) {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
  } catch {
    return dateStr;
  }
}

function _parseAny(val) {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

/**
 * resolveStatus — determine canonical attendance status for a single day.
 *
 * Priority:
 *   1. Explicit Status column value (most authoritative)
 *   2. Absence / Leave fields (structural fields)
 *   3. Clock data inference (fallback)
 */
function resolveStatus({ statusRaw, clockIn, clockOut, absenceRaw, leaveRaw, isLate }) {
  // ── Use the explicit Status column if present ─────────────────────────────
  if (statusRaw && statusRaw !== '') {
    const s = statusRaw.trim().toLowerCase();
    if (s.includes('absent'))                            return 'Absent';
    if (s.includes('holiday'))                           return 'Holiday';
    if (s.includes('leave'))                             return 'Leave';
    if (s.includes('off') || s.includes('week off'))    return 'Day Off';
    if (s.includes('late'))                              return 'Late';
    if (s.includes('present') || s.includes('normal'))  return isLate ? 'Late' : 'Present';
    // Pass-through for any other explicit value (e.g. "Work From Home")
    return statusRaw.trim();
  }

  // ── Infer from Absence / Leave structural fields ──────────────────────────
  const hasAbsence = _hasValue(absenceRaw);
  const hasLeave   = _hasValue(leaveRaw);

  if (hasAbsence) return 'Absent';
  if (hasLeave)   return 'Leave';

  // ── Infer from clock data ─────────────────────────────────────────────────
  if (clockIn === null && clockOut === null) return 'Absent';
  if (isLate)                                return 'Late';
  return 'Present';
}

/** Returns true when val represents a meaningful non-zero, non-null time value */
function _hasValue(val) {
  if (val === null || val === undefined) return false;
  const s = String(val).trim().toLowerCase();
  return s !== '' && s !== '0' && s !== '00:00' && s !== '-' && s !== 'null' && s !== 'n/a';
}

function _parseDurationOrNull(value) {
  if (!_hasValue(value)) return null;
  const parsed = parseTime(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}
