import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { registerAuthInterceptors } from '../services/api';
import {
  decodeJwtExpiryMs,
  loginApi,
  logoutApi,
  refreshSessionApi,
} from '../services/authService';
import type { AuthSessionData, LoginPayload, PermissionKey, UserDto } from '../types/auth';

const SESSION_HINT_KEY = 'hr_hunter_has_session';
const REFRESH_MARGIN_MS = 45_000;

export interface AuthContextValue {
  isAuthenticated: boolean;
  user: UserDto | null;
  token: string | null;
  initialPermissions: PermissionKey[] | null;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<AuthSessionData>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function setSessionHint(active: boolean): void {
  try {
    if (active) {
      window.localStorage.setItem(SESSION_HINT_KEY, '1');
    } else {
      window.localStorage.removeItem(SESSION_HINT_KEY);
    }
  } catch {
    // Ignore storage unavailability in constrained browser contexts
  }
}

function hasSessionHint(): boolean {
  try {
    return window.localStorage.getItem(SESSION_HINT_KEY) === '1';
  } catch {
    return false;
  }
}

function clearCachedPermissions(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith('hr_hunter_rbac_v1_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Ignore storage unavailability
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserDto | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [initialPermissions, setInitialPermissions] = useState<PermissionKey[] | null>(null);
  const [loading, setLoading] = useState<boolean>(() => hasSessionHint());

  const tokenRef = useRef<string | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  const clearScheduledRefresh = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const clearSessionState = useCallback(() => {
    clearScheduledRefresh();
    tokenRef.current = null;
    setToken(null);
    setUser(null);
    setInitialPermissions(null);
    setSessionHint(false);
    clearCachedPermissions();
  }, [clearScheduledRefresh]);

  const applySession = useCallback((session: AuthSessionData) => {
    tokenRef.current = session.accessToken;
    setToken(session.accessToken);
    setUser(session.user);
    setInitialPermissions(Array.isArray(session.permissions) ? session.permissions : null);
    setSessionHint(true);
  }, []);

  const refreshToken = useCallback(async (): Promise<string | null> => {
    try {
      const session = await refreshSessionApi();
      applySession(session);
      return session.accessToken;
    } catch {
      clearSessionState();
      return null;
    }
  }, [applySession, clearSessionState]);

  const login = useCallback(
    async (payload: LoginPayload): Promise<AuthSessionData> => {
      const session = await loginApi(payload);
      applySession(session);
      return session;
    },
    [applySession],
  );

  const logout = useCallback(async (): Promise<void> => {
    clearSessionState();
    try {
      await logoutApi();
    } catch {
      // Clear local session state even if network logout fails
    }
  }, [clearSessionState]);

  useEffect(() => {
    registerAuthInterceptors({
      getToken: () => tokenRef.current,
      refreshSession: refreshToken,
      onAuthFailure: clearSessionState,
    });
  }, [refreshToken, clearSessionState]);

  // Proactive pre-expiry refresh scheduler
  useEffect(() => {
    clearScheduledRefresh();
    if (!token) return undefined;

    const expMs = decodeJwtExpiryMs(token);
    if (!expMs) return undefined;

    const delayMs = Math.max(5_000, expMs - Date.now() - REFRESH_MARGIN_MS);
    refreshTimerRef.current = window.setTimeout(() => {
      void refreshToken();
    }, delayMs);

    return () => {
      clearScheduledRefresh();
    };
  }, [token, refreshToken, clearScheduledRefresh]);

  // Hydrate authenticated session transparently on browser reload when session hint exists
  useEffect(() => {
    let cancelled = false;
    if (!hasSessionHint()) {
      setLoading(false);
      return undefined;
    }

    refreshToken().finally(() => {
      if (!cancelled) {
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(token && user),
      user,
      token,
      initialPermissions,
      loading,
      login,
      logout,
      refreshToken,
    }),
    [token, user, initialPermissions, loading, login, logout, refreshToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
