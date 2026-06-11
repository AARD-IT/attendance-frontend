import React from 'react';

// ─── StatCard ─────────────────────────────────────────────────────────────────
export function StatCard({ icon, label, value, sub, color = 'indigo', delay = 0 }) {
  const colorMap = {
    indigo: {
      icon: 'bg-indigo-50 text-indigo-600 border border-indigo-100',
      glow: 'group-hover:shadow-md',
      border: 'hover:border-indigo-200',
    },
    emerald: {
      icon: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
      glow: 'group-hover:shadow-md',
      border: 'hover:border-emerald-200',
    },
    amber: {
      icon: 'bg-amber-50 text-amber-700 border border-amber-100',
      glow: 'group-hover:shadow-md',
      border: 'hover:border-amber-200',
    },
    cyan: {
      icon: 'bg-cyan-50 text-cyan-700 border border-cyan-100',
      glow: 'group-hover:shadow-md',
      border: 'hover:border-cyan-200',
    },
    rose: {
      icon: 'bg-rose-50 text-rose-700 border border-rose-100',
      glow: 'group-hover:shadow-md',
      border: 'hover:border-rose-200',
    },
  };

  const c = colorMap[color] || colorMap.indigo;

  return (
    <div
      className={`group card p-6 transition-all duration-300 cursor-default ${c.border} ${c.glow} animate-slide-up`}
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.icon}`}>
          {icon}
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Syne, sans-serif' }}>
          {value}
        </div>
        <div className="text-sm font-medium text-slate-600">{label}</div>
        {sub && <div className="text-xs text-slate-500">{sub}</div>}
      </div>
    </div>
  );
}

// ─── ChartCard ────────────────────────────────────────────────────────────────
export function ChartCard({ title, subtitle, children, className = '' }) {
  return (
    <div className={`card p-6 animate-slide-up ${className}`}>
      <div className="mb-5">
        <h3 className="text-base font-semibold text-slate-900" style={{ fontFamily: 'Syne, sans-serif' }}>
          {title}
        </h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
export function StatusBadge({ status }) {
  const map = {
    Present: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    Absent: 'bg-rose-50 text-rose-800 border border-rose-200',
    Late: 'bg-amber-50 text-amber-900 border border-amber-200',
    Holiday: 'bg-sky-50 text-sky-800 border border-sky-200',
    Leave: 'bg-violet-50 text-violet-800 border border-violet-200',
    'Day Off': 'bg-slate-100 text-slate-700 border border-slate-200',
  };
  const cls = map[status] || 'bg-slate-100 text-slate-700 border border-slate-200';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status || '—'}
    </span>
  );
}

// ─── LoadingSpinner ───────────────────────────────────────────────────────────
export function LoadingSpinner({ message = 'Processing...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-2 border-indigo-100"></div>
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-600 animate-spin"></div>
      </div>
      <p className="text-slate-600 text-sm">{message}</p>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4 text-slate-400">
        {icon}
      </div>
      <h3 className="text-slate-800 font-medium mb-1">{title}</h3>
      <p className="text-slate-500 text-sm max-w-xs">{description}</p>
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
export function CustomTooltip({ active, payload, label, formatter }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-lg text-sm">
      {label && <p className="text-slate-500 text-xs mb-2 font-medium">{label}</p>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
          <span className="text-slate-600">{entry.name}:</span>
          <span className="text-slate-900 font-semibold">
            {formatter ? formatter(entry.value, entry.name) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────
export function Table({ columns, data, onRowAction, actionLabel = 'View Details' }) {
  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        }
        title="No data available"
        description="Upload a file or adjust your filters"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80">
            {columns.map(col => (
              <th
                key={col.key}
                className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
              >
                {col.label}
              </th>
            ))}
            {onRowAction && (
              <th className="py-3 px-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((row, i) => (
            <tr key={i} className="group hover:bg-slate-50 transition-colors duration-150">
              {columns.map(col => (
                <td key={col.key} className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                  {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                </td>
              ))}
              {onRowAction && (
                <td className="py-3.5 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => onRowAction(row)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-all duration-150 border border-indigo-100"
                  >
                    {actionLabel}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Search Input ─────────────────────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder = 'Search...' }) {
  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 transition-all shadow-sm"
      />
    </div>
  );
}
