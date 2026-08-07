import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/query-client';

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Point d'entrée des contextes transverses.
 * Phase 1 : AuthProvider · Phase 5 : SocketProvider et ToastProvider.
 */
export function AppProviders({ children }: AppProvidersProps) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
