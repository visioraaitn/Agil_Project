import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { GlobalRole, type AuthenticatedUser, type LoginInput } from '@visiora/shared';
import { setAccessToken } from '@/lib/api-client';
import { authApi } from './api';
import { AuthContext, type AuthState, type AuthStatus } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthenticatedUser | null>(null);

  // Au chargement, on tente de reprendre la session depuis le cookie httpOnly.
  useEffect(() => {
    let cancelled = false;

    authApi
      .restore()
      .then((session) => {
        if (cancelled) return;
        setAccessToken(session.accessToken);
        setUser(session.user);
        setStatus('authenticated');
      })
      .catch(() => {
        if (cancelled) return;
        setAccessToken(null);
        setStatus('anonymous');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const session = await authApi.login(input);
    setAccessToken(session.accessToken);
    setUser(session.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setAccessToken(null);
      setUser(null);
      setStatus('anonymous');
      // Purge le cache : les données du compte précédent ne doivent pas fuir.
      queryClient.clear();
    }
  }, [queryClient]);

  const refreshUser = useCallback(async () => {
    const nextUser = await authApi.me();
    setUser(nextUser);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      isAdmin: user?.globalRole === GlobalRole.ADMIN,
      canManageUsers: user?.globalRole === GlobalRole.ADMIN,
      canManageAdmins: user?.isSuperAdmin === true,
      login,
      logout,
      refreshUser,
    }),
    [status, user, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
