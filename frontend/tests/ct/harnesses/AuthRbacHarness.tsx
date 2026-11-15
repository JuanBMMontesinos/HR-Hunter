import { useMemo, useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LoginForm } from '../../../src/components/auth/LoginForm';
import { PasswordStrengthMeter } from '../../../src/components/auth/PasswordStrengthMeter';
import { RoleProtectedRoute } from '../../../src/components/auth/RoleProtectedRoute';
import { ToastViewport } from '../../../src/components/common/Toast';
import { Sidebar } from '../../../src/components/layout/Sidebar';
import { AuthContext, type AuthContextValue } from '../../../src/contexts/AuthContext';
import {
  PermissionsContext,
  type PermissionsContextValue,
} from '../../../src/contexts/PermissionsContext';
import { ToastProvider } from '../../../src/contexts/ToastContext';
import { AccessDenied } from '../../../src/pages/auth/AccessDenied';
import type { PermissionAction, PermissionKey, PermissionResource, UserDto, UserRole } from '../../../src/types/auth';

const MOCK_USER: UserDto = {
  id: 42,
  email: 'recruiter@hrhunter.com',
  fullName: 'Marina Recrutadora',
  role: 'Recrutador',
  isActive: true,
};

function makePermissionsValue(
  permissions: PermissionKey[],
  permissionsLoading: boolean,
): PermissionsContextValue {
  const can = (resource: PermissionResource, action: PermissionAction) =>
    permissions.includes(`${resource}:${action}`);
  return {
    permissions,
    permissionsLoading,
    can,
    canAny: (checks) => checks.some(([r, a]) => can(r, a)),
    canAll: (checks) => checks.every(([r, a]) => can(r, a)),
    refreshPermissions: async () => {},
  };
}

export function RoleGuardRaceHarness({
  initialPermissionsLoading = true,
  initialPermissions = [] as PermissionKey[],
  role = 'Recrutador' as UserRole,
}: {
  initialPermissionsLoading?: boolean;
  initialPermissions?: PermissionKey[];
  role?: UserRole;
}) {
  const [permsLoading, setPermsLoading] = useState(initialPermissionsLoading);
  const [perms, setPerms] = useState<PermissionKey[]>(initialPermissions);

  const authValue = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: true,
      user: { ...MOCK_USER, role },
      token: 'mock-jwt-token',
      initialPermissions: null,
      loading: false,
      login: async () => {
        throw new Error('Not used');
      },
      logout: async () => {},
      refreshToken: async () => 'mock-jwt-token',
    }),
    [role],
  );

  const permValue = useMemo(
    () => makePermissionsValue(perms, permsLoading),
    [perms, permsLoading],
  );

  return (
    <ToastProvider>
      <AuthContext.Provider value={authValue}>
        <PermissionsContext.Provider value={permValue}>
          <div style={{ marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => {
                setPerms(['users:read', 'dashboard:read']);
                setPermsLoading(false);
              }}
            >
              Resolver com users:read
            </button>
            <button
              type="button"
              onClick={() => {
                setPerms(['dashboard:read']);
                setPermsLoading(false);
              }}
            >
              Resolver sem users:read
            </button>
          </div>

          <MemoryRouter initialEntries={['/users']}>
            <Routes>
              <Route
                path="/users"
                element={
                  <RoleProtectedRoute requiredPermission={['users', 'read']}>
                    <div data-testid="protected-users-content">Área de Usuários Autorizada</div>
                  </RoleProtectedRoute>
                }
              />
              <Route path="/access-denied" element={<AccessDenied />} />
              <Route path="/dashboard" element={<div>Dashboard</div>} />
              <Route path="/login" element={<div>Login</div>} />
            </Routes>
          </MemoryRouter>
        </PermissionsContext.Provider>
      </AuthContext.Provider>
    </ToastProvider>
  );
}

export function LoginFormHarness({
  mode = 'invalid',
}: {
  mode?: 'invalid' | 'locked' | 'ratelimit' | 'success';
}) {
  const [loggedInUser, setLoggedInUser] = useState<string>('');

  const authValue = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: false,
      user: null,
      token: null,
      initialPermissions: null,
      loading: false,
      login: async () => {
        if (mode === 'locked') {
          throw {
            isAxiosError: true,
            response: {
              status: 423,
              data: { error: { code: 'AUTH_004', message: 'Locked' } },
            },
          };
        }
        if (mode === 'ratelimit') {
          throw {
            isAxiosError: true,
            response: {
              status: 429,
              data: { error: { code: 'AUTH_RATE_LIMIT', message: 'Too many attempts' } },
            },
          };
        }
        if (mode === 'invalid') {
          throw {
            isAxiosError: true,
            response: {
              status: 401,
              data: { error: { code: 'AUTH_001', message: 'Invalid credentials' } },
            },
          };
        }

        return {
          accessToken: 'jwt-ok',
          expiresIn: '15m',
          user: MOCK_USER,
          permissions: ['dashboard:read'],
        };
      },
      logout: async () => {},
      refreshToken: async () => null,
    }),
    [mode],
  );

  return (
    <ToastProvider>
      <ToastViewport />
      <AuthContext.Provider value={authValue}>
        <MemoryRouter>
          <LoginForm onSuccess={(u) => setLoggedInUser(u.email)} />
          {loggedInUser ? <output data-testid="login-success-email">{loggedInUser}</output> : null}
        </MemoryRouter>
      </AuthContext.Provider>
    </ToastProvider>
  );
}

export function PasswordStrengthHarness() {
  const [pw, setPw] = useState('');
  return (
    <div>
      <input
        aria-label="Senha teste"
        type="text"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
      />
      <PasswordStrengthMeter password={pw} />
    </div>
  );
}

export function SidebarRbacHarness({
  permissions,
}: {
  permissions: PermissionKey[];
}) {
  const [collapsed, setCollapsed] = useState(false);

  const authValue = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: true,
      user: MOCK_USER,
      token: 'tok',
      initialPermissions: permissions,
      loading: false,
      login: async () => {
        throw new Error('Unused');
      },
      logout: async () => {},
      refreshToken: async () => 'tok',
    }),
    [permissions],
  );

  const permValue = useMemo(() => makePermissionsValue(permissions, false), [permissions]);

  return (
    <AuthContext.Provider value={authValue}>
      <PermissionsContext.Provider value={permValue}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Sidebar
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed((c) => !c)}
            mobileOpen={false}
            onCloseMobile={() => {}}
          />
        </MemoryRouter>
      </PermissionsContext.Provider>
    </AuthContext.Provider>
  );
}
