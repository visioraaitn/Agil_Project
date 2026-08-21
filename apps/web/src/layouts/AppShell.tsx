import { useCallback, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

/** Coquille applicative : barre supérieure + navigation latérale + contenu. */
export function AppShell() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('visiora.sidebar.collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), []);

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      try {
        localStorage.setItem('visiora.sidebar.collapsed', String(next));
      } catch {
        // Le stockage local est optionnel : l'interface reste utilisable sans lui.
      }
      return next;
    });
  };

  return (
    <div className="bg-surface flex h-screen flex-col overflow-hidden">
      <Topbar onOpenSidebar={() => setMobileSidebarOpen(true)} />
      <div className="relative flex min-h-0 flex-1">
        <Sidebar
          collapsed={sidebarCollapsed}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={closeMobileSidebar}
          onCollapseToggle={toggleSidebarCollapsed}
        />
        <main className="min-w-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
