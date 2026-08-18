import { useContext } from 'react';
import { AuthContext, type AuthState } from './auth-context';

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth doit être utilisé dans un <AuthProvider>');
  return context;
}
