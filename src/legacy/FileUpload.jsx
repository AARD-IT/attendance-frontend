import React, { useState, useRef } from 'react';

export default function FileUpload({ onFileUpload, isLoading }) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const validateFile = file => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv',
    ];
    const allowedExts = ['.xlsx', '.xls', '.csv'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();

    if (!allowedExts.includes(ext) && !allowedTypes.includes(file.type)) {
      return 'Please upload an Excel (.xlsx, .xls) or CSV file.';
    }
    if (file.size > 50 * 1024 * 1024) {
      return 'File size must be under 50MB.';
    }
    return null;
  };

  const handleFile = file => {
    setError('');
    const err = validateFile(file);
    if (err) {
      setError(err);
      return;
    }
    onFileUpload(file);
  };

  const handleDrop = e => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = e => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 grid-bg">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-indigo-500/[0.06] rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-xl animate-fade-in relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2.5 mb-6">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-600/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <span className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Syne, sans-serif' }}>
              EMS Dashboard
            </span>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-3" style={{ fontFamily: 'Syne, sans-serif' }}>
            Employee Monitoring
            <span className="text-gradient block">System</span>
          </h1>
          <p className="text-slate-600 text-base max-w-md mx-auto">
            Upload your attendance Excel or CSV file to get started. All processing runs in your browser.
          </p>
        </div>

        <div
          onDragOver={e => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !isLoading && fileInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer
            transition-all duration-300 bg-white shadow-sm
            ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50/80 scale-[1.01] shadow-md'
                : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50/80'
            }
            ${isLoading ? 'cursor-not-allowed opacity-75' : ''}
          `}
        >
          <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-indigo-200 rounded-tl-lg" />
          <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-indigo-200 rounded-tr-lg" />
          <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-indigo-200 rounded-bl-lg" />
          <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-indigo-200 rounded-br-lg" />

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleChange}
            className="hidden"
            disabled={isLoading}
          />

          {isLoading ? (
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 rounded-full border-2 border-indigo-100" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-600 animate-spin" />
              </div>
              <div>
                <p className="text-slate-800 font-medium">Processing your file…</p>
                <p className="text-slate-500 text-sm mt-1">Parsing rows and building the dashboard</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 border ${
                  isDragging
                    ? 'bg-indigo-100 text-indigo-600 border-indigo-200'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}
              >
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <div>
                <p className="text-slate-800 font-semibold text-lg">
                  {isDragging ? 'Drop your file here' : 'Drop file here or click to browse'}
                </p>
                <p className="text-slate-500 text-sm mt-1">Supports .xlsx, .xls, .csv — up to 50MB</p>
              </div>
              <div className="flex items-center gap-2 mt-2">
                {['.xlsx', '.xls', '.csv'].map(ext => (
                  <span
                    key={ext}
                    className="px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-600 font-mono"
                  >
                    {ext}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm animate-fade-in">
            <svg className="w-4 h-4 flex-shrink-0 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        <div className="mt-6 p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          <p className="text-xs text-slate-500 font-medium mb-2">Expected columns in your file</p>
          <div className="flex flex-wrap gap-1.5">
            {['Employee ID', 'First Name', 'Department', 'Date', 'Clock In', 'Clock Out', 'Status', 'Total WT'].map(col => (
              <span key={col} className="text-xs bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded font-mono">
                {col}
              </span>
            ))}
            <span className="text-xs text-slate-400 px-2 py-0.5">+ more…</span>
          </div>
        </div>
      </div>
    </div>
  );
}
