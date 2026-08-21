import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AppShell } from '@/layouts/AppShell';
import { ProjectLayout } from '@/layouts/ProjectLayout';
import { PlaceholderPage } from '@/components/common/PlaceholderPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { PortfolioPage } from '@/features/portfolio/pages/PortfolioPage';
import { ProjectOverviewPage } from '@/features/projects/pages/ProjectOverviewPage';
import { BacklogPage } from '@/features/backlog/pages/BacklogPage';
import { BoardPage } from '@/features/board/pages/BoardPage';
import { CalendarPage } from '@/features/reports/pages/CalendarPage';
import { DashboardPage } from '@/features/reports/pages/DashboardPage';
import { RoadmapPage } from '@/features/roadmap/pages/RoadmapPage';
import { ReposPage } from '@/features/repos/pages/ReposPage';
import { SettingsPage } from '@/features/settings/pages/SettingsPage';
import { SprintsPage } from '@/features/sprints/pages/SprintsPage';
import { UsersPage } from '@/features/admin/pages/UsersPage';
import { RequireAuth, RequireProductOwner } from './guards';

/**
 * Les pages livrées sont montées ; celles des phases suivantes restent des
 * placeholders annotés de leur phase et de leur référence au cahier des charges.
 */
const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/',
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/portfolio" replace /> },
          { path: 'portfolio', element: <PortfolioPage /> },
          { path: 'settings', element: <SettingsPage /> },
          {
            path: 'admin',
            element: <RequireProductOwner />,
            children: [{ path: 'users', element: <UsersPage /> }],
          },
          {
            path: 'projects/:projectKey',
            element: <ProjectLayout />,
            children: [
              { index: true, element: <Navigate to="overview" replace /> },
              { path: 'overview', element: <ProjectOverviewPage /> },
              { path: 'boards', element: <BoardPage /> },
              { path: 'backlog', element: <BacklogPage /> },
              { path: 'sprints', element: <SprintsPage /> },
              { path: 'roadmap', element: <RoadmapPage /> },
              { path: 'repos', element: <ReposPage /> },
              { path: 'dashboards', element: <DashboardPage /> },
              { path: 'calendar', element: <CalendarPage /> },
            ],
          },
          {
            path: '*',
            element: (
              <PlaceholderPage
                title="Page introuvable"
                phase="—"
                description="Cette adresse n'existe pas."
              />
            ),
          },
        ],
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
