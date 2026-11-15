import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getPermissionsApi } from '../services/authService';
import type { PermissionAction, PermissionKey, PermissionResource } from '../types/auth';
import { useAuth } from './AuthContext';

const PERMISSIONS_CACHE_PREFIX = 'hr_hunter_rbac_v1_';
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedPermissionsEntry {
  cachedAt: number;
  ttlMs: number;
  permissions: PermissionKey[];
}

export interface PermissionsContextValue {
  permissions: PermissionKey[];
  permissionsLoading: boolean;
  can: (resource: PermissionResource, action: PermissionAction) => boolean;
  canAny: (checks: Array<[PermissionResource, PermissionAction]>) => boolean;
  canAll: (checks: Array<[PermissionResource, PermissionAction]>) => boolean;
  refreshPermissions: () => Promise<void>;
}

export const PermissionsContext = createContext<PermissionsContextValue | undefined>(undefined);

function getCacheKey(userId: number, role: string): string {
  return `${PERMISSIONS_CACHE_PREFIX}${userId}_${role}`;
}

function readCachedPermissions(userId: number, role: string): PermissionKey[] | null {
  try {
    const raw = window.localStorage.getItem(getCacheKey(userId, role));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPermissionsEntry;
    if (
      !parsed ||
      !Array.isArray(parsed.permissions) ||
      typeof parsed.cachedAt !== 'number' ||
      typeof parsed.ttlMs !== 'number'
    ) {
      return null;
    }
    if (Date.now() - parsed.cachedAt > parsed.ttlMs) {
      window.localStorage.removeItem(getCacheKey(userId, role));
      return null;
    }
    return parsed.permissions;
  } catch {
    return null;
  }
}

function writeCachedPermissions(
  userId: number,
  role: string,
  permissions: PermissionKey[],
  ttlSeconds?: number,
): void {
  try {
    const ttlMs =
      typeof ttlSeconds === 'number' && ttlSeconds > 0 ? ttlSeconds * 1000 : DEFAULT_CACHE_TTL_MS;
    const payload: CachedPermissionsEntry = {
      cachedAt: Date.now(),
      ttlMs,
      permissions,
    };
    window.localStorage.setItem(getCacheKey(userId, role), JSON.stringify(payload));
  } catch {
    // Ignore storage unavailability
  }
}

export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user, token, initialPermissions, loading: authLoading } = useAuth();

  const currentUserKey = isAuthenticated && user ? `${user.id}:${user.role}` : null;

  const [syncedState, setSyncedState] = useState<{
    userKey: string | null;
    permissions: PermissionKey[];
  }>({
    userKey: null,
    permissions: [],
  });
  const [fetching, setFetching] = useState(false);

  const loadPermissions = useCallback(
    async (forceNetwork = false) => {
      if (!isAuthenticated || !user || !token) {
        setSyncedState({ userKey: null, permissions: [] });
        setFetching(false);
        return;
      }

      const targetKey = `${user.id}:${user.role}`;

      if (!forceNetwork) {
        if (initialPermissions && initialPermissions.length > 0) {
          writeCachedPermissions(user.id, user.role, initialPermissions);
          setSyncedState({ userKey: targetKey, permissions: initialPermissions });
          return;
        }

        const cached = readCachedPermissions(user.id, user.role);
        if (cached) {
          setSyncedState({ userKey: targetKey, permissions: cached });
          return;
        }
      }

      setFetching(true);
      try {
        const data = await getPermissionsApi();
        const perms = Array.isArray(data.permissions) ? data.permissions : [];
        writeCachedPermissions(user.id, user.role, perms, data.ttlSeconds);
        setSyncedState({ userKey: targetKey, permissions: perms });
      } catch {
        setSyncedState({ userKey: targetKey, permissions: [] });
      } finally {
        setFetching(false);
      }
    },
    [isAuthenticated, user, token, initialPermissions],
  );

  useEffect(() => {
    if (authLoading) return;
    void loadPermissions(false);
  }, [authLoading, currentUserKey, loadPermissions]);

  const effectivePermissions = useMemo<PermissionKey[]>(() => {
    if (!currentUserKey) return [];
    if (syncedState.userKey === currentUserKey) {
      return syncedState.permissions;
    }
    if (initialPermissions && initialPermissions.length > 0) {
      return initialPermissions;
    }
    return [];
  }, [currentUserKey, syncedState, initialPermissions]);

  // Guard against any single-render race between auth resolution and permissions sync
  const isWaitingForSync =
    Boolean(currentUserKey) &&
    syncedState.userKey !== currentUserKey &&
    !(initialPermissions && initialPermissions.length > 0);

  const permissionsLoading = authLoading || fetching || isWaitingForSync;

  const can = useCallback(
    (resource: PermissionResource, action: PermissionAction): boolean => {
      const key: PermissionKey = `${resource}:${action}`;
      return (
        effectivePermissions.includes(key) ||
        effectivePermissions.includes(`${resource}:*`) ||
        effectivePermissions.includes('*:*')
      );
    },
    [effectivePermissions],
  );

  const canAny = useCallback(
    (checks: Array<[PermissionResource, PermissionAction]>): boolean =>
      checks.some(([resource, action]) => can(resource, action)),
    [can],
  );

  const canAll = useCallback(
    (checks: Array<[PermissionResource, PermissionAction]>): boolean =>
      checks.every(([resource, action]) => can(resource, action)),
    [can],
  );

  const refreshPermissions = useCallback(async () => {
    await loadPermissions(true);
  }, [loadPermissions]);

  const value = useMemo<PermissionsContextValue>(
    () => ({
      permissions: effectivePermissions,
      permissionsLoading,
      can,
      canAny,
      canAll,
      refreshPermissions,
    }),
    [effectivePermissions, permissionsLoading, can, canAny, canAll, refreshPermissions],
  );

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
};

export function usePermissionsContext(): PermissionsContextValue {
  const ctx = useContext(PermissionsContext);
  if (!ctx) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return ctx;
}
