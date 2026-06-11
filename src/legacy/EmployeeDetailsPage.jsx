import React, { useMemo, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

import { ChartCard, StatusBadge, CustomTooltip } from '../components/UI.jsx';
import {
  computeEmployeeStats,
  computeReportMetrics,
  minutesToTimeString,
  minutesToHourMin,
  formatDateDDMMYYYY,
  formatDurationHHMM,
  safeNum,
  LOGIN_DEVIATION_AFTER_MINUTES,
  LOGOUT_DEVIATION_BEFORE_MINUTES,
} from '../utils/dataProcessor.js';

/** Same filter as computeReportMetrics — rows shown in First & Last style table */
function isReportOfficeRow(r) {
  const s = r.status ?? 'Unknown';
  return s !== 'Absent' && s !== 'Holiday' && s !== 'Day Off' && s !== 'Leave';
}

/**
 * @param {{ employee: { id?: string, name?: string, records: Array }, loginRank: number | null, onBack: () => void }} props
 */
export default function EmployeeDetailsPage({ employee, loginRank, onBack }) {
  const [detailTab, setDetailTab] = useState('attendance');

  const stats = useMemo(() => computeEmployeeStats(employee), [employee]);
  const report = useMemo(() => computeReportMetrics(employee), [employee]);

  const attendanceRows = useMemo(
    () =>
      [...employee.records]
        .filter(r => r.date && isReportOfficeRow(r))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [employee]
  );

  const records = useMemo(
    () =>
      [...employee.records]
        .filter(r => r.date)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [employee]
  );

  const workHoursData = useMemo(
    () =>
      records
        .filter(r => r.workHours > 0)
        .map(r => ({
          date: r.date,
          label: r.date.slice(5),
          hours: safeNum(r.workHours, 0),
          clockIn: safeNum(r.clockInHours),
          clockOut: safeNum(r.clockOutHours),
        })),
    [records]
  );

  const avgHours = stats.avgWorkHours != null ? parseFloat(stats.avgWorkHours.toFixed(2)) : null;

  const formatHour = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '';
    const h = Math.floor(val);
    const m = Math.round((val - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const loginRuleLabel = minutesToTimeString(LOGIN_DEVIATION_AFTER_MINUTES);
  const logoutRuleLabel = minutesToTimeString(LOGOUT_DEVIATION_BEFORE_MINUTES);

  const summaryRows = useMemo(
    () => [
      { label: 'id', value: employee.id || '—' },
      { label: 'Name', value: employee.name },
      { label: 'Days in office', value: String(report.daysInOffice) },
      {
        label: 'Avg login time',
        value: stats.avgClockIn != null ? minutesToTimeString(stats.avgClockIn) : '—',
      },
      {
        label: 'Avg logout time',
        value: stats.avgClockOut != null ? minutesToTimeString(stats.avgClockOut) : '—',
      },
      {
        label: 'Avg hours worked per day',
        value: stats.avgWorkHours != null ? minutesToTimeString(Math.round(stats.avgWorkHours * 60)) : '—',
      },
      {
        label: 'login_deviation',
        value: String(report.loginDeviation),
        hint: `Days with first punch after ${loginRuleLabel}`,
      },
      {
        label: 'Logout_deviation',
        value: String(report.logoutDeviation),
        hint: `Days with last punch before ${logoutRuleLabel}`,
      },
      {
        label: 'Rank based on login',
        value: loginRank != null ? String(loginRank) : '—',
        hint: '1 = earliest average login company-wide',
      },
      {
        label: "Didn't log in and log off",
        value: String(report.didntLogBoth),
        hint: 'Days missing a valid first punch, last punch, or both',
      },
    ],
    [employee, report, stats, loginRank, loginRuleLabel, logoutRuleLabel]
  );

  const tabBtn = (id, label) => (
    <button
      type="button"
      key={id}
      onClick={() => setDetailTab(id)}
      className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border ${
        detailTab === id
          ? 'bg-indigo-50 text-indigo-800 border-indigo-200 shadow-sm'
          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 shadow-sm transition-all duration-200 flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </button>

        <div className="card p-5 flex-1">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 text-2xl font-bold flex-shrink-0"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              {employee.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Syne, sans-serif' }}>
                {employee.name}
              </h1>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                {employee.id && <span className="text-slate-500 text-sm font-mono">ID: {employee.id}</span>}
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-700 font-medium">
                  {employee.department}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 sm:gap-6 text-center w-full sm:w-auto">
              <div>
                <div className="text-lg font-bold text-amber-700 font-mono">
                  {stats.avgClockIn != null ? minutesToTimeString(stats.avgClockIn) : '—'}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">Avg Login</div>
              </div>
              <div>
                <div className="text-lg font-bold text-emerald-700 font-mono">
                  {stats.avgClockOut != null ? minutesToTimeString(stats.avgClockOut) : '—'}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">Avg Logout</div>
              </div>
              <div>
                <div className="text-lg font-bold text-indigo-700 font-mono">
                  {stats.avgWorkHours != null ? minutesToHourMin(stats.avgWorkHours * 60) : '—'}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">Avg Hours</div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-200 pt-5">
            {tabBtn('attendance', `${employee.name.split(' ')[0] || employee.name} attendance`)}
            {tabBtn('average', `${employee.name.split(' ')[0] || employee.name} avg attendance`)}
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Deviations: first punch after {loginRuleLabel} · last punch before {logoutRuleLabel}
          </p>
        </div>
      </div>

      {detailTab === 'attendance' && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-base font-semibold text-slate-900" style={{ fontFamily: 'Syne, sans-serif' }}>
              Daily attendance
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{attendanceRows.length} rows</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90">
                  {['id', 'Name', 'Date', 'Weekday', 'First Punch', 'Last Punch', 'Total Time'].map(col => (
                    <th
                      key={col}
                      className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attendanceRows.map((rec, i) => (
                  <tr key={`${rec.date}-${i}`} className="hover:bg-slate-50 transition-colors duration-100">
                    <td className="py-3 px-4 text-slate-500 font-mono text-xs">{employee.id || '—'}</td>
                    <td className="py-3 px-4 text-slate-800">{employee.name}</td>
                    <td className="py-3 px-4 text-slate-700 font-mono text-xs whitespace-nowrap">
                      {formatDateDDMMYYYY(rec.date)}
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs">{rec.weekday || '—'}</td>
                    <td className="py-3 px-4 font-mono text-sm text-amber-700">{rec.clockInStr}</td>
                    <td className="py-3 px-4 font-mono text-sm text-emerald-700">{rec.clockOutStr}</td>
                    <td className="py-3 px-4 font-mono text-sm text-slate-800">
                      {rec.workingMinutes > 0 ? formatDurationHHMM(rec.workingMinutes) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {attendanceRows.length === 0 && (
              <div className="py-12 text-center text-slate-500 text-sm">No attendance rows for this period.</div>
            )}
          </div>
        </div>
      )}

      {detailTab === 'average' && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-base font-semibold text-slate-900" style={{ fontFamily: 'Syne, sans-serif' }}>
              Average attendance
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Summary for this upload</p>
          </div>
          <div className="divide-y divide-slate-100">
            {summaryRows.map(row => (
              <div
                key={row.label}
                className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-6 py-3.5 hover:bg-slate-50"
              >
                <div className="text-slate-500 text-sm font-medium w-full sm:w-56 shrink-0">{row.label}</div>
                <div className="flex items-baseline gap-2 flex-1 min-w-0">
                  <span className="text-slate-900 font-mono text-sm">{row.value}</span>
                  {row.hint && <span className="text-slate-500 text-xs truncate">{row.hint}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        {[
          { label: 'Total Days', value: records.length, color: 'text-slate-800' },
          { label: 'Present', value: stats.presentDays, color: 'text-emerald-600' },
          { label: 'Absent', value: stats.absentDays, color: 'text-rose-600' },
          { label: 'On Leave', value: stats.leaveDays, color: 'text-violet-600' },
          { label: 'Late Days', value: stats.lateDays, color: 'text-amber-600' },
          { label: 'Early Leave', value: stats.earlyLeaveDays, color: 'text-cyan-600' },
          {
            label: 'Attendance',
            value: records.length > 0 ? `${Math.round((stats.presentDays / records.length) * 100)}%` : '—',
            color: 'text-indigo-600',
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="card px-4 py-4">
            <div className={`text-2xl font-bold ${color}`} style={{ fontFamily: 'Syne, sans-serif' }}>
              {value}
            </div>
            <div className="text-xs text-slate-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Daily Working Hours" subtitle="Hours per working day">
          {workHoursData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={workHoursData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                  tickFormatter={v => `${v}h`}
                />
                {avgHours != null && (
                  <ReferenceLine
                    y={avgHours}
                    stroke="#6366f1"
                    strokeDasharray="5 5"
                    strokeWidth={1.5}
                    label={{ value: `Avg: ${avgHours}h`, fill: '#4f46e5', fontSize: 10, position: 'right' }}
                  />
                )}
                <Tooltip content={<CustomTooltip formatter={v => `${v}h`} />} />
                <Line
                  type="monotone"
                  dataKey="hours"
                  name="Work Hours"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#6366f1' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-slate-600 text-sm">No working hours data</div>
          )}
        </ChartCard>

        <ChartCard title="Login vs Logout Times" subtitle="Daily clock-in and clock-out comparison">
          {workHoursData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={workHoursData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                  domain={['auto', 'auto']}
                  tickFormatter={v => formatHour(v)}
                />
                <Tooltip content={<CustomTooltip formatter={v => formatHour(v)} />} />
                <Bar dataKey="clockIn" name="Clock In" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                <Bar dataKey="clockOut" name="Clock Out" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-slate-600 text-sm">No clock data</div>
          )}
          <div className="flex items-center gap-4 mt-2 justify-end">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-xs text-slate-500">Clock In</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-xs text-slate-500">Clock Out</span>
            </div>
          </div>
        </ChartCard>
      </div>

      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900" style={{ fontFamily: 'Syne, sans-serif' }}>
              Full records
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{records.length} days · includes schedule & status</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90">
                {[
                  'Date',
                  'Day',
                  'Check In',
                  'Check Out',
                  'Clock In',
                  'Clock Out',
                  'Hours',
                  'Late',
                  'Early Leave',
                  'Req. Work',
                  'Status',
                ].map(col => (
                  <th
                    key={col}
                    className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((rec, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors duration-100">
                  <td className="py-3 px-4 text-slate-700 whitespace-nowrap font-mono text-xs">{rec.date || '—'}</td>
                  <td className="py-3 px-4 text-slate-600 text-xs">{rec.weekday || '—'}</td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-sm text-slate-500">{rec.checkInStr}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-sm text-slate-500">{rec.checkOutStr}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`font-mono text-sm ${rec.clockInStr !== '--:--' ? (rec.isLate ? 'text-amber-700' : 'text-emerald-700') : 'text-slate-400'}`}
                    >
                      {rec.clockInStr}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`font-mono text-sm ${rec.clockOutStr !== '--:--' ? (rec.isEarlyLeave ? 'text-rose-600' : 'text-emerald-700') : 'text-slate-400'}`}
                    >
                      {rec.clockOutStr}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-slate-800 text-sm">
                      {rec.workingMinutes > 0 ? minutesToHourMin(rec.workingMinutes) : '—'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {rec.isLate ? (
                      <span className="text-amber-700 text-xs font-mono">+{minutesToHourMin(rec.lateMinutes)}</span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {rec.isEarlyLeave ? (
                      <span className="text-cyan-700 text-xs font-mono">-{minutesToHourMin(rec.earlyLeaveMinutes)}</span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-xs font-medium ${
                        rec.workRequirement === 'Completed'
                          ? 'text-emerald-700'
                          : rec.workRequirement === 'Underworked'
                            ? 'text-rose-600'
                            : 'text-slate-500'
                      }`}
                    >
                      {rec.workRequirement === 'No Schedule' ? '—' : rec.workRequirement}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={rec.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
