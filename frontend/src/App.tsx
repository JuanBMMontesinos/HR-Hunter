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
import { ModuleShellPage } from './pages/ModuleShellPage';
import { AccessDenied } from './pages/auth/AccessDenied';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { Login } from './pages/auth/Login';
import { ResetPassword } from './pages/auth/ResetPassword';

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
                      <ModuleShellPage
                        moduleKey="dashboard"
                        titleKey="nav.dashboard"
                        subtitleKey="pages.dashboardSubtitle"
                      />
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/companies"
                  element={
                    <RoleProtectedRoute requiredPermission={['companies', 'read']}>
                      <ModuleShellPage
                        moduleKey="companies"
                        titleKey="nav.companies"
                        subtitleKey="pages.companiesSubtitle"
                      />
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/job-openings"
                  element={
                    <RoleProtectedRoute requiredPermission={['job_openings', 'read']}>
                      <ModuleShellPage
                        moduleKey="job_openings"
                        titleKey="nav.jobOpenings"
                        subtitleKey="pages.jobOpeningsSubtitle"
                      />
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/candidates"
                  element={
                    <RoleProtectedRoute requiredPermission={['candidates', 'read']}>
                      <ModuleShellPage
                        moduleKey="candidates"
                        titleKey="nav.candidates"
                        subtitleKey="pages.candidatesSubtitle"
                      />
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/processes"
                  element={
                    <RoleProtectedRoute requiredPermission={['processes', 'read']}>
                      <ModuleShellPage
                        moduleKey="processes"
                        titleKey="nav.processes"
                        subtitleKey="pages.processesSubtitle"
                      />
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/users"
                  element={
                    <RoleProtectedRoute requiredPermission={['users', 'read']}>
                      <ModuleShellPage
                        moduleKey="users"
                        titleKey="nav.users"
                        subtitleKey="pages.usersSubtitle"
                      />
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <RoleProtectedRoute requiredPermission={['settings', 'read']}>
                      <ModuleShellPage
                        moduleKey="settings"
                        titleKey="nav.settings"
                        subtitleKey="pages.settingsSubtitle"
                      />
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ModuleShellPage
                      moduleKey="profile"
                      titleKey="nav.profile"
                      subtitleKey="pages.profileSubtitle"
                    />
                  }
                />
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
