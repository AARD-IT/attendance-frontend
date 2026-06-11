/**
 * ============================================================
 * dataProcessor.js — Excel ingestion + orchestration layer
 * ============================================================
 *
 * Responsibilities:
 *   1. Read an Excel / CSV file with SheetJS
 *   2. Auto-detect the header row (handles merged cells / title rows)
 *   3. Normalize column names to canonical keys
 *   4. Parse every row into a typed DayRecord via buildDayRecord()
 *   5. Group records into per-employee objects
 *   6. Return { employees, dates, statusCounts }
 *
 * Does NOT contain any business logic.
 * Business logic lives in calculateStats.js.
 * Time math lives in timeUtils.js.
 * ============================================================
 */

import * as XLSX from 'xlsx';
import {
  parseTime,
  minutesToTimeString,
  minutesToHourMin,
  formatTime,
  safeNum,
  formatDurationHHMM,
} from './timeUtils.js';
import {
  buildDayRecord,
  calculateEmployeeStats,
  getDailyAttendanceTrend,
  getTopEmployeesByWorkHours,
  computeReportMetrics,
  computeLoginRanks,
  LOGIN_DEVIATION_AFTER_MINUTES,
  LOGOUT_DEVIATION_BEFORE_MINUTES,
} from './calculateStats.js';

// ─── Re-exports (pages still import these from dataProcessor) ─────────────────
export { minutesToTimeString, minutesToHourMin, formatTime, safeNum, formatDurationHHMM };
export {
  calculateEmployeeStats as computeEmployeeStats,
  getDailyAttendanceTrend,
  getTopEmployeesByWorkHours,
  computeReportMetrics,
  computeLoginRanks,
  LOGIN_DEVIATION_AFTER_MINUTES,
  LOGOUT_DEVIATION_BEFORE_MINUTES,
};

// ─── Date parsing ─────────────────────────────────────────────────────────────

/**
 * parseDate(value) → "YYYY-MM-DD" | null
 * Handles: Excel date serial, "YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"
 */
export function parseDate(value) {
  if (!value && value !== 0) return null;

  if (typeof value === 'number') {
    try {
      const d = XLSX.SSF.parse_date_code(value);
      if (!d) return null;
      return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    } catch {
      return null;
    }
  }

  const s = String(value).trim();
  if (!s) return null;

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  // DD/MM/YYYY  or  MM/DD/YYYY  or  YYYY/MM/DD
  const parts = s.split(/[\/\-\.]/);
  if (parts.length >= 3) {
    const [a, b, c] = parts;
    if (a.length === 4) return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;         // YYYY-first
    if (c.length === 4) return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;         // YYYY-last
  }
  return s; // return as-is and hope for the best
}

/**
 * formatDateShort("2025-04-01") → "Tue, 01 Apr"
 */
export function formatDateShort(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
  } catch {
    return dateStr;
  }
}

/**
 * formatDateDDMMYYYY("2026-04-08") → "08-04-2026" (matches typical attendance export)
 * @param {string | null | undefined} isoDate
 */
export function formatDateDDMMYYYY(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return '—';
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return isoDate;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// ─── Excel ingestion ──────────────────────────────────────────────────────────

/**
 * parseExcelFile(file) → Promise<Array<Object>>
 *
 * Returns raw row objects keyed by the original Excel header strings.
 * Header row is auto-detected by scanning the first 10 rows.
 */
export async function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const bytes     = new Uint8Array(e.target.result);
        const workbook  = XLSX.read(bytes, { type: 'array', cellDates: false });
        const sheet     = workbook.Sheets[workbook.SheetNames[0]];

        // Read everything as raw array-of-arrays so we can detect the header row
        const allRows = XLSX.utils.sheet_to_json(sheet, {
          header:    1,
          raw:       true,
          defval:    null,
          blankrows: false,
        });

        if (!allRows || allRows.length === 0) {
          reject(new Error('The file appears to be empty.'));
          return;
        }

        // ── Find the header row ───────────────────────────────────────────────
        let headerIndex = _findHeaderRow(allRows);
        if (headerIndex === -1) headerIndex = 0; // fallback: first row

        const headerRow = allRows[headerIndex];
        const dataRows  = allRows.slice(headerIndex + 1);

        // ── Build key→value objects ───────────────────────────────────────────
        const jsonData = dataRows
          .filter(row => row && row.some(cell => cell !== null && cell !== undefined && cell !== ''))
          .map(row => {
            const obj = {};
            headerRow.forEach((header, idx) => {
              if (header !== null && header !== undefined && String(header).trim() !== '') {
                obj[String(header).trim()] = (row[idx] !== undefined) ? row[idx] : null;
              }
            });
            return obj;
          });

        console.log('[EMS] Header row index:', headerIndex);
        console.log('[EMS] Columns detected:', headerRow?.filter(Boolean));
        console.log('[EMS] Data rows:', jsonData.length);
        if (jsonData[0]) console.log('[EMS] First row sample:', jsonData[0]);

        resolve(jsonData);
      } catch (err) {
        reject(new Error('Failed to parse file: ' + err.message));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

// ─── Column normalisation ─────────────────────────────────────────────────────

/**
 * _normalizeRow(rawRow) → canonical field object
 *
 * Accepts any casing / spacing of column names and maps to canonical keys.
 */
function _normalizeRow(rawRow) {
  // Build: normalized-key → original-key
  const keyMap = {};
  Object.keys(rawRow).forEach(k => {
    keyMap[k.trim().toLowerCase().replace(/\s+/g, ' ')] = k;
  });

  const get = (...variants) => {
    for (const v of variants) {
      const norm = v.toLowerCase().replace(/\s+/g, ' ');
      if (keyMap[norm] !== undefined) return rawRow[keyMap[norm]];
    }
    return null;
  };

  return {
    no:           get('no', 'no.', '#', 'sr no', 'sr.no', 'sno', 's.no'),
    employeeId:   get('employee id', 'employeeid', 'emp id', 'empid', 'employee_id', 'emp_id', 'id'),
    firstName:    get('first name', 'firstname', 'name', 'employee name', 'emp name', 'first_name'),
    department:   get('department', 'dept', 'department name'),
    date:         get('date'),
    weekday:      get('weekday', 'day', 'week day'),
    timetable:    get('timetable', 'time table', 'time_table'),

    // ── Schedule times ───────────────────────────────────────────────────────
    checkIn:      get('check in', 'checkin', 'check-in', 'check_in'),
    checkOut:     get('check out', 'checkout', 'check-out', 'check_out'),
    dutyDuration: get('duty duration', 'duty_duration'),

    // ── Actual times ─────────────────────────────────────────────────────────
    workDay:      get('work day', 'workday', 'work_day'),
    clockIn:      get('clock in', 'clockin', 'clock-in', 'clock_in', 'first punch', 'first in', 'punch in', 'in time'),
    clockOut:     get('clock out', 'clockout', 'clock-out', 'clock_out', 'last punch', 'last out', 'punch out', 'out time'),

    // ── Work duration columns ─────────────────────────────────────────────────
    requiredWork: get('required work', 'required wt', 'required_work', 'required_wt'),
    actualWT:     get('actual wt', 'actual working time', 'actual_wt'),
    unscheduled:  get('unscheduled'),
    remaining:    get('remaining'),
    totalWT:      get('total wt', 'total working time', 'total_wt', 'total time'),
    normalWT:     get('normal wt', 'normal_wt'),

    // ── OT columns ────────────────────────────────────────────────────────────
    weekdayOT:    get('weekday ot', 'weekday_ot'),
    weekOffOT:    get('week off ot', 'week_off_ot', 'weekoff ot'),
    holidayOT:    get('holiday ot', 'holiday_ot'),

    // ── Status / absence columns ─────────────────────────────────────────────
    late:         get('late'),
    earlyLeave:   get('early', 'early leave', 'early_leave'),
    leave:        get('leave'),
    absence:      get('absence', 'absent'),
    status:       get('status'),
  };
}

// ─── Main processor ───────────────────────────────────────────────────────────

/**
 * processEmployeeData(rawRows) → { employees, dates, statusCounts }
 *
 * @param {Array<Object>} rawRows   Output of parseExcelFile()
 * @returns {{
 *   employees:    Record<string, Employee>,
 *   dates:        string[],
 *   statusCounts: Record<string, number>,
 * }}
 *
 * Employee shape:
 * {
 *   id:         string,
 *   name:       string,
 *   department: string,
 *   records:    DayRecord[],
 * }
 */
export function processEmployeeData(rawRows) {
  if (!rawRows || rawRows.length === 0) {
    return { employees: {}, dates: [], statusCounts: {} };
  }

  const employees    = {};
  const allDates     = new Set();
  const statusCounts = {};

  for (const rawRow of rawRows) {
    // ── Normalize column names ──────────────────────────────────────────────
    const row = _normalizeRow(rawRow);

    const name  = String(row.firstName  || '').trim();
    const empId = String(row.employeeId || '').trim();

    // Skip empty rows and repeated header rows
    if (!name && !empId) continue;
    if (_isHeaderLike(name) || _isHeaderLike(empId)) continue;

    // Employee key — prefer ID, fall back to name
    const key = empId || name;

    if (!employees[key]) {
      employees[key] = {
        id:         empId,
        name:       name || `Employee ${empId}`,
        department: String(row.department || 'N/A').trim(),
        records:    [],
      };
    }

    // ── Parse all time values via parseTime() ─────────────────────────────
    const checkIn     = parseTime(row.checkIn);
    const checkOut    = parseTime(row.checkOut);
    const clockIn      = parseTime(row.clockIn);
    const clockOut     = parseTime(row.clockOut);
    const requiredWork = parseTime(row.requiredWork);
    const totalWT     = parseTime(row.totalWT);
    const actualWT    = parseTime(row.actualWT);
    const normalWT    = parseTime(row.normalWT);
    const weekdayOT   = parseTime(row.weekdayOT);
    const weekOffOT   = parseTime(row.weekOffOT);
    const holidayOT   = parseTime(row.holidayOT);
    const dutyDuration = parseTime(row.dutyDuration);

    // ── Parse date ────────────────────────────────────────────────────────
    const dateStr = parseDate(row.date);
    if (dateStr) allDates.add(dateStr);

    // ── Build the fully-typed day record ──────────────────────────────────
    const rec = buildDayRecord({
      date:         dateStr,
      weekday:      String(row.weekday  || ''),
      timetable:    String(row.timetable || ''),
      department:   String(row.department || employees[key].department || 'N/A').trim(),

      checkIn,
      checkOut,
      clockIn,
      clockOut,
      requiredWork,
      totalWT,
      actualWT,
      normalWT,
      weekdayOT,
      weekOffOT,
      holidayOT,
      dutyDuration,

      statusRaw:    String(row.status    || '').trim(),
      absenceRaw:   row.absence,
      leaveRaw:     row.leave,
      lateRaw:      row.late,
      earlyLeaveRaw: row.earlyLeave,
      unscheduled:  row.unscheduled,
      remaining:    row.remaining,
    });

    // Tally statuses for the dashboard pie chart
    if (rec.status) {
      statusCounts[rec.status] = (statusCounts[rec.status] || 0) + 1;
    }

    employees[key].records.push(rec);
  }

  const sortedDates = [...allDates].sort();
  return { employees, dates: sortedDates, statusCounts };
}

// ─── Private helpers ──────────────────────────────────────────────────────────

const HEADER_KEYWORDS = new Set([
  'first name', 'employee id', 'employee name', 'name', 'id',
  'date', 'department', 'status',
]);

function _isHeaderLike(str) {
  return HEADER_KEYWORDS.has(str.toLowerCase());
}

function _findHeaderRow(allRows) {
  for (let i = 0; i < Math.min(10, allRows.length); i++) {
    const row = allRows[i];
    if (!row || !Array.isArray(row)) continue;
    const rowStr = row.map(c => String(c || '').toLowerCase().trim()).join(' ');
    if (
      rowStr.includes('employee id') ||
      rowStr.includes('employeeid')  ||
      rowStr.includes('first name')  ||
      rowStr.includes('firstname')   ||
      (rowStr.includes('clock in') && rowStr.includes('clock out')) ||
      (rowStr.includes('first punch') && rowStr.includes('last punch')) ||
      (rowStr.includes('date') && rowStr.includes('department'))
    ) {
      return i;
    }
  }
  return -1;
}
