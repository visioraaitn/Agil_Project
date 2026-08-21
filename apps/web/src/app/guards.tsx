import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/use-auth';
import { LoadingState } from '@/components/common/StateMessage';

/** Réserve les routes enfants aux utilisateurs authentifiés. */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <LoadingState label="Restauration de la session…" />;
  if (status === 'anonymous') {
    // `from` permet de revenir à la page demandée après connexion.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

/**
 * Réserve les routes d'administration. Ce contrôle n'est qu'un confort
 * d'affichage : l'API refuse de toute façon les requêtes sans `user:manage`.
 */
export function RequireProductOwner() {
  const { canManageUsers } = useAuth();
  if (!canManageUsers) return <Navigate to="/portfolio" replace />;
  return <Outlet />;
}
