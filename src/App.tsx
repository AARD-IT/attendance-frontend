import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './pages/LoginPage'
import SignUpPage from './pages/SignUpPage'
import AuthCallbackPage from './pages/AuthCallbackPage'
import CEODashboard from './pages/CEODashboard'
import CEOAttendanceReportsAlerts from './pages/CEOAttendanceReportsAlerts'
import CEOAttendanceReportsEmployeeProfile from './pages/CEOAttendanceReportsEmployeeProfile'
import CEOMployeeDetails from './pages/CEOMployeeDetails'
import CEOShiftManagement from './pages/CEOShiftManagement'
import EmployeeDashboard from './pages/EmployeeDashboard'
import NotFoundPage from './pages/NotFoundPage'
import { ProtectedRoute } from './components/ProtectedRoute'

function HomeRedirect() {
  const auth = useAuth()

  if (auth.loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm text-slate-700">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 rounded-full border-b-2 border-slate-700 animate-spin" />
            <span>Checking authentication...</span>
          </div>
        </div>
      </div>
    )
  }

  if (!auth.isAuthenticated()) {
    return <Navigate to="/login" replace />
  }

  return <Navigate to={auth.user?.role === 'CEO' ? '/ceo/dashboard' : '/employee/dashboard'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route
            path="/ceo/dashboard"
            element={
              <ProtectedRoute requiredRole="CEO">
                <CEODashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ceo/employees"
            element={
              <ProtectedRoute requiredRole="CEO">
                <CEODashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ceo/employees/:id"
            element={
              <ProtectedRoute requiredRole="CEO">
                <CEOMployeeDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ceo/shift-management"
            element={
              <ProtectedRoute requiredRole="CEO">
                <CEOShiftManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ceo/attendance-reports-alerts"
            element={
              <ProtectedRoute requiredRole="CEO">
                <CEOAttendanceReportsAlerts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ceo/attendance-reports-alerts/:employeeId"
            element={
              <ProtectedRoute requiredRole="CEO">
                <CEOAttendanceReportsEmployeeProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/dashboard"
            element={
              <ProtectedRoute requiredRole="EMPLOYEE">
                <EmployeeDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<HomeRedirect />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
