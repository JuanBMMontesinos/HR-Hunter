import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PrivateRoute } from './components/auth/PrivateRoute';
import { RoleProtectedRoute } from './components/auth/RoleProtectedRoute';
import { ToastViewport } from './components/common/Toast';
import { MainLayout } from './components/layout/MainLayout';
import { AuthProvider } from './contexts/AuthContext';
import { PermissionsProvider } from './contexts/PermissionsContext';
import { ToastProvider } from './contexts/ToastContext';
import { AccessDenied } from './pages/auth/AccessDenied';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { Login } from './pages/auth/Login';
import { ResetPassword } from './pages/auth/ResetPassword';
import { CandidatesPage } from './pages/candidates/CandidatesPage';
import { CompaniesPage } from './pages/companies/CompaniesPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { JobOpeningsPage } from './pages/job-openings/JobOpeningsPage';
import { ProcessesPage } from './pages/processes/ProcessesPage';
import { ProfilePage } from './pages/profile/ProfilePage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { UsersPage } from './pages/users/UsersPage';

function LanguageSync() {
  const { i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.lang = i18n.language || 'pt-BR';
  }, [i18n.language]);

  return null;
}

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <PermissionsProvider>
          <BrowserRouter>
            <LanguageSync />
            <ToastViewport />

            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/access-denied" element={<AccessDenied />} />

              <Route
                element={
                  <PrivateRoute>
                    <MainLayout />
                  </PrivateRoute>
                }
              >
                <Route
                  path="/dashboard"
                  element={
                    <RoleProtectedRoute requiredPermission={['dashboard', 'read']}>
                      <DashboardPage />
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/companies"
                  element={
                    <RoleProtectedRoute requiredPermission={['companies', 'read']}>
                      <CompaniesPage />
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/job-openings"
                  element={
                    <RoleProtectedRoute requiredPermission={['job_openings', 'read']}>
                      <JobOpeningsPage />
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/candidates"
                  element={
                    <RoleProtectedRoute requiredPermission={['candidates', 'read']}>
                      <CandidatesPage />
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/processes"
                  element={
                    <RoleProtectedRoute requiredPermission={['processes', 'read']}>
                      <ProcessesPage />
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/users"
                  element={
                    <RoleProtectedRoute requiredPermission={['users', 'read']}>
                      <UsersPage />
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <RoleProtectedRoute requiredPermission={['settings', 'read']}>
                      <SettingsPage />
                    </RoleProtectedRoute>
                  }
                />
                <Route path="/profile" element={<ProfilePage />} />
              </Route>

              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </PermissionsProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
