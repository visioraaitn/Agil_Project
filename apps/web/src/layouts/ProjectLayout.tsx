import { Outlet } from 'react-router-dom';

/**
 * Contexte projet : point d'accroche des données partagées entre les écrans
 * d'un même projet (filtres de board, sprint actif) à partir de la phase 2.
 * Chaque page porte son propre en-tête.
 */
export function ProjectLayout() {
  return (
    <div className="h-full">
      <Outlet />
    </div>
  );
}
