/**
 * ============================================================
 * timeUtils.js — Production-grade time parsing & formatting
 * ============================================================
 *
 * All internal values are stored as MINUTES since midnight (integer).
 * Null is the canonical "no data" sentinel — never NaN, never -1.
 *
 * Supported input formats:
 *   • Excel serial time fraction  e.g.  0.354166 (= 08:30)
 *   • Excel datetime serial       e.g.  45678.354166
 *   • "HH:mm"                     e.g.  "08:30"
 *   • "H:mm"                      e.g.  "8:05"
 *   • "HH:mm:ss"                  e.g.  "09:00:00"
 *   • "H:mm AM/PM"                e.g.  "9:00 AM"
 *   • Null / undefined / empty    → returns null safely
 * ============================================================
 */

// ─── Internal guard helpers ───────────────────────────────────────────────────

/** Returns true for values that are definitely "no data" */
function isNoData(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'number' && isNaN(value)) return true;
  const s = String(value).trim().toLowerCase();
  return s === '' || s === '-' || s === '--' || s === 'n/a' || s === 'absent' || s === '0' || s === 'null';
}

/** Clamp to a valid minute value in [0, 1439].  Returns null if invalid. */
function clampMinutes(min) {
  if (min === null || isNaN(min)) return null;
  const v = Math.round(min);
  if (v < 0 || v > 1439) return null; // outside 00:00 – 23:59
  return v;
}

// ─── Core: parseTime ──────────────────────────────────────────────────────────

/**
 * parseTime(value) → number (minutes since midnight) | null
 *
 * Never throws.  Returns null when value is absent or unrecognisable.
 */
export function parseTime(value) {
  if (isNoData(value)) return null;

  // ── Numeric: Excel serial ─────────────────────────────────────────────────
  if (typeof value === 'number') {
    // Excel stores dates as integers >= 1 (days since 1900-01-01).
    // Times are stored as fractions of a day (0 ≤ frac < 1).
    // Datetime = integer part (date) + fractional part (time).
    const frac = value - Math.floor(value);

    if (frac === 0) {
      // Pure integer — could be a date serial (no time component) or 00:00.
      // We can't tell without context, so return null — callers handle this.
      return null;
    }
    return clampMinutes(frac * 24 * 60);
  }

  // ── String ────────────────────────────────────────────────────────────────
  const str = String(value).trim();
  if (!str) return null;

  // HH:mm, H:mm, HH:mm:ss, H:mm:ss (with optional AM/PM)
  const match = str.match(
    /^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?$/i
  );

  if (match) {
    let hours   = parseInt(match[1], 10);
    const mins  = parseInt(match[2], 10);
    const ampm  = (match[4] || '').toUpperCase();

    if (isNaN(hours) || isNaN(mins)) return null;
    if (mins < 0 || mins > 59)       return null;

    if (ampm === 'PM' && hours !== 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours  = 0;

    return clampMinutes(hours * 60 + mins);
  }

  return null; // unrecognised string
}

// ─── Core: timeDifference ─────────────────────────────────────────────────────

/**
 * timeDifference(startMin, endMin) → number (minutes) | null
 *
 * Returns endMin - startMin.
 * Returns null when either argument is null (missing data).
 * Returns 0 (not negative) when start === end.
 * Does NOT auto-wrap midnight — if you cross midnight the result will be
 * negative and you should pass allowNegative: true to get the raw diff.
 *
 * @param {number|null} startMin
 * @param {number|null} endMin
 * @param {{ allowNegative?: boolean }} options
 */
export function timeDifference(startMin, endMin, { allowNegative = false } = {}) {
  if (startMin === null || endMin === null) return null;
  if (typeof startMin !== 'number' || typeof endMin !== 'number') return null;

  const diff = endMin - startMin;
  if (!allowNegative && diff < 0) return null; // clock-out before clock-in → bad data
  if (diff === 0) return 0;
  return diff;
}

// ─── Core: formatTime ────────────────────────────────────────────────────────

/**
 * formatTime(minutes, style) → string
 *
 * @param {number|null} minutes   — minutes since midnight, or a duration in minutes
 * @param {'hhmm'|'h:mm'|'human'} style
 *   • 'hhmm'  → "08:30"   (default — good for clock times)
 *   • 'h:mm'  → "8:30"    (no zero-pad on hours)
 *   • 'human' → "8h 30m"  (good for durations)
 */
export function formatTime(minutes, style = 'hhmm') {
  if (minutes === null || minutes === undefined || isNaN(minutes)) {
    return style === 'human' ? '—' : '--:--';
  }

  const totalMins = Math.round(minutes);

  if (style === 'human') {
    if (totalMins < 0) return '0m';
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  // Clock time styles — wrap around 24 h
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;

  if (style === 'h:mm') return `${h}:${String(m).padStart(2, '0')}`;
  // default: 'hhmm'
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ─── Convenience aliases (used by dataProcessor & pages) ─────────────────────

/**
 * minutesToTimeString(min) → "HH:mm"  |  '--:--'
 * (drop-in for the old helper)
 */
export function minutesToTimeString(min) {
  return formatTime(min, 'hhmm');
}

/**
 * minutesToHourMin(min) → "Xh Ym"  |  '—'
 * (drop-in for the old helper)
 */
export function minutesToHourMin(min) {
  if (min === null || min === undefined || isNaN(min) || min < 0) return '0h 0m';
  return formatTime(min, 'human');
}

/**
 * safeNum(value, fallback?) → number
 * Never returns NaN or undefined — used before sending to Recharts.
 */
export function safeNum(value, fallback = 0) {
  if (value === null || value === undefined || isNaN(value)) return fallback;
  const n = Number(value);
  return isNaN(n) ? fallback : n;
}

/**
 * formatDurationHHMM(totalMinutes) → "07:22" (hours may exceed 24 for multi-day sums)
 * @param {number|null|undefined} totalMinutes
 * @returns {string}
 */
export function formatDurationHHMM(totalMinutes) {
  if (totalMinutes === null || totalMinutes === undefined || isNaN(totalMinutes) || totalMinutes <= 0) {
    return '—';
  }
  const total = Math.round(totalMinutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
