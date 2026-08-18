import { createContext } from 'react';
import type { AuthenticatedUser, LoginInput } from '@visiora/shared';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthState {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  /** `true` si l'utilisateur est administrateur de la plateforme. */
  isAdmin: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);
