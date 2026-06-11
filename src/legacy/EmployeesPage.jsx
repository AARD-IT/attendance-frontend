import React, { useMemo, useState } from 'react';
import { SearchInput } from '../components/UI.jsx';
import { computeEmployeeStats, minutesToTimeString, minutesToHourMin, safeNum } from '../utils/dataProcessor.js';

export default function EmployeesPage({ employees, onViewDetails }) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  const employeeList = useMemo(() => {
    return Object.values(employees).map(emp => {
      const stats = computeEmployeeStats(emp);
      return {
        id: emp.id,
        name: emp.name,
        department: emp.department,
        avgWorkHours: stats.avgWorkHours,
        avgClockIn: stats.avgClockIn,
        avgClockOut: stats.avgClockOut,
        presentDays: stats.presentDays,
        totalDays: stats.totalDays,
        lateDays: safeNum(stats.lateDays),
        didntLogInDays: safeNum(stats.didntLogInDays),
        didntLogOutDays: safeNum(stats.didntLogOutDays),
        _emp: emp,
      };
    });
  }, [employees]);

  const filtered = useMemo(() => {
    let list = employeeList.filter(
      e =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.department.toLowerCase().includes(search.toLowerCase())
    );

    list = list.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [employeeList, search, sortField, sortDir]);

  const handleSort = field => {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="text-slate-400 ml-1">↕</span>;
    return <span className="text-indigo-600 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const departments = useMemo(() => {
    const depts = new Set(employeeList.map(e => e.department));
    return [...depts].filter(Boolean).sort();
  }, [employeeList]);

  const [deptFilter, setDeptFilter] = useState('all');
  const finalList = useMemo(
    () => (deptFilter === 'all' ? filtered : filtered.filter(e => e.department === deptFilter)),
    [filtered, deptFilter]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Syne, sans-serif' }}>
            All Employees
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {filtered.length} of {employeeList.length} employees
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="bg-white border border-slate-200 text-slate-800 text-sm rounded-xl px-3 py-2.5 shadow-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 cursor-pointer"
          >
            <option value="all">All Departments</option>
            {departments.map(d => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <div className="w-full sm:w-64">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by name or department..."
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: employeeList.length, color: 'text-indigo-600' },
          { label: 'Departments', value: departments.length, color: 'text-cyan-600' },
          {
            label: 'Avg Login',
            value: (() => {
              const logins = employeeList.map(e => e.avgClockIn).filter(v => v !== null);
              if (!logins.length) return '—';
              return minutesToTimeString(logins.reduce((a, b) => a + b, 0) / logins.length);
            })(),
            color: 'text-amber-600',
          },
          {
            label: 'Avg Logout',
            value: (() => {
              const outs = employeeList.map(e => e.avgClockOut).filter(v => v !== null);
              if (!outs.length) return '—';
              return minutesToTimeString(outs.reduce((a, b) => a + b, 0) / outs.length);
            })(),
            color: 'text-emerald-600',
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="card px-4 py-3 flex items-center gap-3">
            <div className="flex flex-col">
              <span className={`text-lg font-bold ${color}`} style={{ fontFamily: 'Syne, sans-serif' }}>
                {value}
              </span>
              <span className="text-xs text-slate-500">{label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90">
                {[
                  { key: 'name', label: 'Employee Name' },
                  { key: 'department', label: 'Department' },
                  { key: 'presentDays', label: 'Present Days' },
                  { key: 'didntLogInDays', label: "Didn't Log In" },
                  { key: 'didntLogOutDays', label: "Didn't Log Out" },
                  { key: 'avgWorkHours', label: 'Avg Work Hours' },
                  { key: 'avgClockIn', label: 'Avg Login' },
                  { key: 'avgClockOut', label: 'Avg Logout' },
                ].map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="text-left py-3.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-slate-800 transition-colors select-none"
                  >
                    {col.label}
                    <SortIcon field={col.key} />
                  </th>
                ))}
                <th className="py-3.5 px-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {finalList.map((emp, i) => (
                <tr
                  key={emp.id || emp.name}
                  className="group hover:bg-slate-50 transition-colors duration-150"
                  style={{ animationDelay: `${i * 20}ms` }}
                >
                  <td className="py-4 px-4">
                    <button
                      type="button"
                      onClick={() => onViewDetails(emp._emp)}
                      className="flex items-center gap-3 text-left rounded-lg -m-1 p-1 hover:bg-slate-100 transition-colors w-full min-w-0"
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center flex-shrink-0 text-indigo-700 text-xs font-bold">
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-slate-800 font-medium hover:text-indigo-700 underline-offset-2 group-hover:underline">
                          {emp.name}
                        </div>
                        {emp.id && <div className="text-slate-500 text-xs font-mono">#{emp.id}</div>}
                      </div>
                    </button>
                  </td>
                  <td className="py-4 px-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-700 font-medium">
                      {emp.department}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-200 rounded-full h-1.5 w-16">
                        <div
                          className="bg-emerald-500 h-1.5 rounded-full"
                          style={{ width: `${emp.totalDays > 0 ? (emp.presentDays / emp.totalDays) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-slate-600 text-xs">
                        {emp.presentDays}/{emp.totalDays}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-rose-600 font-mono text-sm">{emp.didntLogInDays}</span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-orange-600 font-mono text-sm">{emp.didntLogOutDays}</span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-slate-700 font-mono text-sm">
                      {emp.avgWorkHours != null ? minutesToHourMin(emp.avgWorkHours * 60) : '—'}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-amber-700 font-mono text-sm">
                      {emp.avgClockIn ? minutesToTimeString(emp.avgClockIn) : '—'}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-emerald-700 font-mono text-sm">
                      {emp.avgClockOut ? minutesToTimeString(emp.avgClockOut) : '—'}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => onViewDetails(emp._emp)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-all duration-200 border border-indigo-100"
                    >
                      View Details →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {finalList.length === 0 && (
            <div className="py-16 text-center text-slate-500">
              <p>No employees found matching your search.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
