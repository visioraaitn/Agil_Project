import { createContext } from 'react';
import type { AuthenticatedUser, LoginInput } from '@visiora/shared';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthState {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  /** Administration technique de la plateforme. */
  isAdmin: boolean;
  /** Gestion des comptes membres, accessible aux administrateurs. */
  canManageUsers: boolean;
  /** Gestion des comptes administrateurs, réservée au super administrateur. */
  canManageAdmins: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);
