import React, { useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

import { StatCard, ChartCard, CustomTooltip } from '../components/UI.jsx';
import {
  computeEmployeeStats,
  getDailyAttendanceTrend,
  getTopEmployeesByWorkHours,
  minutesToTimeString,
  minutesToHourMin,
  safeNum,
} from '../utils/dataProcessor.js';

const COLORS = {
  indigo: '#6366f1',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  cyan: '#06b6d4',
  purple: '#a855f7',
  teal: '#14b8a6',
};

const STATUS_COLORS = {
  Present: COLORS.emerald,
  Absent: COLORS.rose,
  Late: COLORS.amber,
  Holiday: COLORS.cyan,
  Leave: '#a855f7',
  'Day Off': '#64748b',
};

const PIE_COLORS = [COLORS.emerald, COLORS.rose, COLORS.amber, COLORS.cyan, '#a855f7', '#64748b'];

// Custom Pie Label
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
  if (percent < 0.04) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="600">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function DashboardPage({ employees, dates, statusCounts }) {
  const employeeList = useMemo(() => Object.values(employees), [employees]);

  // ─── Summary Stats ──────────────────────────────────────────────────────────
  const summaryStats = useMemo(() => {
    const allStats = employeeList.map(e => computeEmployeeStats(e));
    const clockIns  = allStats.map(s => s.avgClockIn).filter(v => v !== null);
    const clockOuts = allStats.map(s => s.avgClockOut).filter(v => v !== null);
    const workHours = allStats.map(s => s.avgWorkHours).filter(v => v !== null);

    const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

    return {
      totalEmployees: employeeList.length,
      avgWorkHours:   avg(workHours),
      avgClockIn:     avg(clockIns),
      avgClockOut:    avg(clockOuts),
      totalLate:      allStats.reduce((a, s) => a + safeNum(s.lateDays), 0),
      totalAbsent:    allStats.reduce((a, s) => a + safeNum(s.absentDays), 0),
    };
  }, [employeeList]);

  // ─── Chart Data ─────────────────────────────────────────────────────────────
  const topEmployeesData = useMemo(() => getTopEmployeesByWorkHours(employees, 12), [employees]);

  const dailyTrend = useMemo(() => {
    const trend = getDailyAttendanceTrend(employees, dates);
    // Sample if too many dates
    if (trend.length > 30) {
      const step = Math.ceil(trend.length / 30);
      return trend.filter((_, i) => i % step === 0);
    }
    return trend;
  }, [employees, dates]);

  const pieData = useMemo(() => {
    return Object.entries(statusCounts)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [statusCounts]);

  // Clock-in trend per day (avg across employees)
  const clockInTrend = useMemo(() => {
    return dates.slice(0, 30).map(date => {
      const recs = employeeList.flatMap(e =>
        e.records.filter(r => r.date === date && r.clockIn !== null)
      );
      if (!recs.length) return null;

      const avgClockIn  = recs.reduce((a, r) => a + r.clockIn, 0) / recs.length;
      const outRecs     = recs.filter(r => r.clockOut !== null);
      const avgClockOut = outRecs.length
        ? outRecs.reduce((a, r) => a + r.clockOut, 0) / outRecs.length
        : null;

      return {
        date,
        label:    date.slice(5),
        clockIn:  safeNum(avgClockIn  / 60),
        clockOut: avgClockOut !== null ? safeNum(avgClockOut / 60) : null,
      };
    }).filter(Boolean);
  }, [dates, employeeList]);

  const formatHour = (val) => {
    if (val === null || val === undefined) return '';
    const h = Math.floor(val);
    const m = Math.round((val - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-8 animate-fade-in">

      {/* ─── Summary Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
          label="Total Employees"
          value={summaryStats.totalEmployees}
          sub={`Across ${new Set(employeeList.map(e => e.department)).size} departments`}
          color="indigo"
          delay={0}
        />
        <StatCard
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          label="Avg Working Hours"
          value={summaryStats.avgWorkHours ? minutesToHourMin(summaryStats.avgWorkHours * 60) : '—'}
          sub="Per employee per day"
          color="emerald"
          delay={100}
        />
        <StatCard
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
          }
          label="Avg Login Time"
          value={summaryStats.avgClockIn ? minutesToTimeString(summaryStats.avgClockIn) : '—'}
          sub="Average clock-in across team"
          color="amber"
          delay={200}
        />
        <StatCard
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          }
          label="Avg Logout Time"
          value={summaryStats.avgClockOut ? minutesToTimeString(summaryStats.avgClockOut) : '—'}
          sub="Average clock-out across team"
          color="cyan"
          delay={300}
        />
      </div>

      {/* ─── Row 1: Bar + Pie ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard
          title="Total Working Hours"
          subtitle="Top employees by total hours"
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topEmployeesData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
                tickFormatter={v => `${v}h`}
              />
              <Tooltip
                content={<CustomTooltip formatter={(v, name) => [`${v}h`, name === 'totalHours' ? 'Total Hours' : 'Avg Hours']} />}
              />
              <Bar dataKey="totalHours" name="totalHours" fill={COLORS.indigo} radius={[4, 4, 0, 0]} />
              <Bar dataKey="avgHours" name="avgHours" fill={COLORS.cyan} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 justify-end">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
              <span className="text-xs text-slate-500">Total Hours</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
              <span className="text-xs text-slate-500">Avg Daily Hours</span>
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Attendance Status" subtitle="Distribution breakdown">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
                labelLine={false}
                label={renderCustomLabel}
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={STATUS_COLORS[entry.name] || PIE_COLORS[index % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                content={<CustomTooltip />}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="mt-2 space-y-1.5">
            {pieData.slice(0, 6).map((entry, index) => (
              <div key={entry.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: STATUS_COLORS[entry.name] || PIE_COLORS[index % PIE_COLORS.length] }}
                  ></div>
                  <span className="text-xs text-slate-600">{entry.name}</span>
                </div>
                <span className="text-xs font-semibold text-slate-800">{entry.value}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* ─── Row 2: Line Chart (Attendance Trend) ───────────────────────── */}
      {dailyTrend.length > 0 && (
        <ChartCard
          title="Daily Attendance Trend"
          subtitle={`${dates.length} days of attendance data`}
        >
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={dailyTrend} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id="gradPresent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.emerald} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.emerald} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradAbsent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.rose} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.rose} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradLate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.amber} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.amber} stopOpacity={0} />
                </linearGradient>
              </defs>
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
              />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="present" name="Present" stroke={COLORS.emerald} fill="url(#gradPresent)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="absent" name="Absent" stroke={COLORS.rose} fill="url(#gradAbsent)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="late" name="Late" stroke={COLORS.amber} fill="url(#gradLate)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-5 mt-2 justify-end">
            {[['Present', COLORS.emerald], ['Absent', COLORS.rose], ['Late', COLORS.amber]].map(([label, color]) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
                <span className="text-xs text-slate-500">{label}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      )}

      {/* ─── Row 3: Clock-In/Out Trend ───────────────────────────────────── */}
      {clockInTrend.length > 0 && (
        <ChartCard
          title="Clock In / Clock Out Trend"
          subtitle="Average login & logout times across team"
        >
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={clockInTrend} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
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
              <Tooltip
                content={<CustomTooltip formatter={(v) => formatHour(v)} />}
              />
              <Line
                type="monotone"
                dataKey="clockIn"
                name="Clock In"
                stroke={COLORS.indigo}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: COLORS.indigo }}
              />
              <Line
                type="monotone"
                dataKey="clockOut"
                name="Clock Out"
                stroke={COLORS.emerald}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: COLORS.emerald }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-5 mt-2 justify-end">
            {[['Clock In', COLORS.indigo], ['Clock Out', COLORS.emerald]].map(([label, color]) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
                <span className="text-xs text-slate-500">{label}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      )}
    </div>
  );
}
