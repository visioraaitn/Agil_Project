import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AppShell } from '../layouts/AppShell';
import { ProjectLayout } from '../layouts/ProjectLayout';
import { PlaceholderPage } from '../components/common/PlaceholderPage';

/**
 * Arborescence des routes. Les pages sont pour l'instant des placeholders
 * annotés de leur phase de livraison — la navigation est réelle, pas le contenu.
 */
const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <PlaceholderPage
        title="Connexion"
        phase="Phase 1"
        description="Formulaire email / mot de passe, JWT et restauration de session."
        standalone
      />
    ),
  },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/portfolio" replace /> },
      {
        path: 'portfolio',
        element: (
          <PlaceholderPage
            title="Portefeuille de projets"
            phase="Phase 1"
            reference="B.2"
            description="Tous les projets sur un tableau unique, avec avancement, statut et échéances."
          />
        ),
      },
      {
        path: 'admin/users',
        element: (
          <PlaceholderPage
            title="Utilisateurs"
            phase="Phase 1"
            reference="A.1 · A.2"
            description="Création, modification, désactivation des comptes et attribution des rôles."
          />
        ),
      },
      {
        path: 'projects/:projectKey',
        element: <ProjectLayout />,
        children: [
          { index: true, element: <Navigate to="overview" replace /> },
          {
            path: 'overview',
            element: (
              <PlaceholderPage
                title="Vue d'ensemble"
                phase="Phase 1"
                reference="B.1"
                description="Informations du projet, membres, dépôts référencés et activité récente."
              />
            ),
          },
          {
            path: 'boards',
            element: (
              <PlaceholderPage
                title="Task Board"
                phase="Phase 2"
                reference="D.1"
                description="Kanban 5 colonnes avec glisser-déposer, filtré sur le sprint actif."
              />
            ),
          },
          {
            path: 'backlog',
            element: (
              <PlaceholderPage
                title="Backlog"
                phase="Phase 2"
                reference="C.1 · C.2"
                description="Liste hiérarchique Epic > Story > Sous-tâche, priorisation par glisser-déposer."
              />
            ),
          },
          {
            path: 'sprints',
            element: (
              <PlaceholderPage
                title="Sprints"
                phase="Phase 3"
                reference="C.3"
                description="Création, objectif, affectation depuis le backlog, clôture et rétrospective."
              />
            ),
          },
          {
            path: 'roadmap',
            element: (
              <PlaceholderPage
                title="Roadmap"
                phase="Phase 3"
                reference="C.4"
                description="Vue chronologique de la planification des epics."
              />
            ),
          },
          {
            path: 'repos',
            element: (
              <PlaceholderPage
                title="Dépôts & Pull Requests"
                phase="Phase 4"
                reference="E.1"
                description="Dépôts Git externes référencés, branches, déclaration et approbation des PR."
              />
            ),
          },
          {
            path: 'dashboards',
            element: (
              <PlaceholderPage
                title="Tableaux de bord"
                phase="Phase 6"
                reference="F.1 · F.2"
                description="Burndown, vélocité, indicateurs clés et tâches bloquées."
              />
            ),
          },
          {
            path: 'calendar',
            element: (
              <PlaceholderPage
                title="Calendrier"
                phase="Phase 6"
                reference="F.3"
                description="Sprints, échéances et jalons du projet."
              />
            ),
          },
        ],
      },
      {
        path: '*',
        element: (
          <PlaceholderPage title="Page introuvable" phase="—" description="Cette adresse n'existe pas." />
        ),
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
