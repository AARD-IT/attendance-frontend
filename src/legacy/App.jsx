import React, { useState, useCallback, useMemo } from 'react';
import FileUpload from './components/FileUpload.jsx';
import Navbar from './components/Navbar.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import EmployeesPage from './pages/EmployeesPage.jsx';
import EmployeeDetailsPage from './pages/EmployeeDetailsPage.jsx';
import { parseExcelFile, processEmployeeData, computeLoginRanks } from './utils/dataProcessor.js';

export default function App() {
  const [appState, setAppState] = useState('upload'); // 'upload' | 'dashboard'
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [rawData, setRawData] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Process raw data into structured form
  const processedData = useMemo(() => {
    if (!rawData) return null;
    return processEmployeeData(rawData);
  }, [rawData]);

  const loginRanks = useMemo(() => {
    if (!processedData?.employees) return {};
    return computeLoginRanks(processedData.employees);
  }, [processedData]);

  const selectedEmployeeRank = useMemo(() => {
    if (!selectedEmployee) return null;
    const key = String(selectedEmployee.id || '').trim() || String(selectedEmployee.name || '').trim();
    return key ? loginRanks[key] ?? null : null;
  }, [selectedEmployee, loginRanks]);

  const handleFileUpload = useCallback(async (file) => {
    setIsLoading(true);
    setError('');

    try {
      const data = await parseExcelFile(file);
      if (!data || data.length === 0) {
        throw new Error('The file appears to be empty or has no data rows.');
      }
      // Quick pre-check: ensure some meaningful data
      console.log('[EMS] Raw rows parsed:', data.length, '| Sample keys:', Object.keys(data[0] || {}));
      setRawData(data);
      setFileName(file.name);
      setAppState('dashboard');
      setActiveTab('dashboard');
    } catch (err) {
      setError(err.message || 'Failed to process file. Please check the format.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setAppState('upload');
    setRawData(null);
    setFileName('');
    setError('');
    setSelectedEmployee(null);
    setActiveTab('dashboard');
  }, []);

  const handleViewDetails = useCallback((emp) => {
    setSelectedEmployee(emp);
    setActiveTab('details');
  }, []);

  const handleBackFromDetails = useCallback(() => {
    setSelectedEmployee(null);
    setActiveTab('employees');
  }, []);

  // ─── Upload screen ───────────────────────────────────────────────────────
  if (appState === 'upload') {
    return (
      <div className="min-h-screen bg-slate-50 relative">
        <FileUpload onFileUpload={handleFileUpload} isLoading={isLoading} />
        {error && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-rose-50 border border-rose-200 text-rose-800 px-5 py-3 rounded-xl text-sm max-w-md text-center shadow-lg animate-fade-in">
            {error}
          </div>
        )}
      </div>
    );
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────
  if (!processedData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading data...</div>
      </div>
    );
  }

  const { employees, dates, statusCounts } = processedData;

  // No employees recognized — show helpful error
  if (Object.keys(employees).length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg text-center space-y-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900">No Employee Data Recognized</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            Your file was uploaded ({rawData?.length || 0} rows found) but no employee records could be parsed.
            Make sure your Excel file has the header row: <strong className="text-slate-800">Employee ID</strong>, <strong className="text-slate-800">First Name</strong>, <strong className="text-slate-800">Date</strong>, and either <strong className="text-slate-800">Clock In / Clock Out</strong> or <strong className="text-slate-800">First Punch / Last Punch</strong>.
          </p>
          <p className="text-slate-500 text-xs">
            Check the browser console (F12) to see which columns were detected.
          </p>
          <button
            onClick={handleReset}
            className="mt-4 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
          >
            ← Upload a Different File
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 grid-bg">
      <Navbar
        activeTab={activeTab === 'details' ? 'employees' : activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'details') setSelectedEmployee(null);
        }}
        fileName={fileName}
        onReset={handleReset}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Breadcrumb for details */}
        {activeTab === 'details' && selectedEmployee && (
          <div className="mb-6 flex items-center gap-2 text-sm text-slate-500">
            <button
              type="button"
              onClick={() => setActiveTab('employees')}
              className="hover:text-slate-800 text-indigo-600 transition-colors"
            >
              Employees
            </button>
            <span className="text-slate-400">›</span>
            <span className="text-slate-800 font-medium">{selectedEmployee.name}</span>
          </div>
        )}

        {/* Tabs content */}
        {activeTab === 'dashboard' && (
          <DashboardPage
            employees={employees}
            dates={dates}
            statusCounts={statusCounts}
          />
        )}

        {activeTab === 'employees' && (
          <EmployeesPage
            employees={employees}
            onViewDetails={handleViewDetails}
          />
        )}

        {activeTab === 'details' && selectedEmployee && (
          <EmployeeDetailsPage
            employee={selectedEmployee}
            loginRank={selectedEmployeeRank}
            onBack={handleBackFromDetails}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-6 mt-4 border-t border-slate-200">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>EMS Dashboard · {Object.keys(employees).length} employees · {dates.length} days</span>
          <span>Data processed locally — no server upload</span>
        </div>
      </footer>
    </div>
  );
}
