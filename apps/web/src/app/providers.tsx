import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { queryClient } from '@/lib/query-client';

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Contextes transverses. L'AuthProvider est à l'intérieur du QueryClientProvider :
 * il purge le cache à la déconnexion.
 * Phase 5 : SocketProvider et ToastProvider.
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
