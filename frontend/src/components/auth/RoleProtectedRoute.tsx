import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import type { PermissionAction, PermissionResource, UserRole } from '../../types/auth';
import { Loader } from '../common/Loader';

export interface RoleProtectedRouteProps {
  requiredPermission?: [PermissionResource, PermissionAction];
  anyPermissions?: Array<[PermissionResource, PermissionAction]>;
  allowedRoles?: UserRole[];
  redirectTo?: string;
  children?: ReactNode;
}

/**
 * Guards routes by authentication + granular RBAC permission/role.
 * Strictly waits for both `authLoading` and `permissionsLoading` before making any redirect decision
 * so slow permission syncs never cause false `/access-denied` flashes.
 */
export function RoleProtectedRoute({
  requiredPermission,
  anyPermissions,
  allowedRoles,
  redirectTo = '/access-denied',
  children,
}: RoleProtectedRouteProps) {
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const { permissionsLoading, can, canAny } = usePermissions();
  const location = useLocation();

  if (authLoading || permissionsLoading) {
    return <Loader fullScreen />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <Navigate
        to={redirectTo}
        state={{ from: location, resource: requiredPermission?.[0] }}
        replace
      />
    );
  }

  if (requiredPermission && !can(requiredPermission[0], requiredPermission[1])) {
    return (
      <Navigate
        to={redirectTo}
        state={{ from: location, resource: requiredPermission[0] }}
        replace
      />
    );
  }

  if (anyPermissions && anyPermissions.length > 0 && !canAny(anyPermissions)) {
    return (
      <Navigate
        to={redirectTo}
        state={{ from: location, resource: anyPermissions[0]?.[0] }}
        replace
      />
    );
  }

  return <>{children ?? <Outlet />}</>;
}
