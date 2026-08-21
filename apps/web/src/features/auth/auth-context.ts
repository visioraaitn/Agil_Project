import { createContext } from 'react';
import type { AuthenticatedUser, LoginInput } from '@visiora/shared';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthState {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  /** Administration technique des projets (Admin ou Product Owner plateforme). */
  isAdmin: boolean;
  /** Gouvernance des comptes et attribution des rôles, réservée au Product Owner. */
  canManageUsers: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);
