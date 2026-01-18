/**
 * App Shell Layout - with auth integration and alert badge
 */

import { Outlet, NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../api/auth';
import { getApi } from '../api/client';
import { Badge } from './ui';

export default function AppShell() {
  const { user, logout } = useAuth();

  // Poll alerts for badge count
  const { data: alertsData } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => getApi<{ alerts: unknown[]; activeCount: number }>('/alerts'),
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const activeAlerts = alertsData?.activeCount || 0;

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/upstreams', label: 'Upstreams', icon: '🌐' },
    { path: '/self-test', label: 'Self-Test', icon: '🔍' },
    { path: '/logs', label: 'Logs', icon: '📋' },
    { path: '/alerts', label: 'Alerts', icon: '🔔', badge: activeAlerts },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  // Dev-only style guide link
  const isDev = import.meta.env.DEV;

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 glass-dark p-4 flex flex-col">
        <div className="px-4 mb-8">
          <div className="text-xl font-bold text-white">Pusula</div>
          {user && (
            <div className="text-white/50 text-sm mt-1">
              {user.username}
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map(({ path, label, icon, badge }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-white/20 text-white shadow-lg'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <span className="text-lg">{icon}</span>
              <span className="font-medium flex-1">{label}</span>
              {badge !== undefined && badge > 0 && (
                <Badge size="sm" variant="danger" dot pulse>
                  {badge}
                </Badge>
              )}
            </NavLink>
          ))}
          
          {isDev && (
            <NavLink
              to="/style-guide"
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'text-white/50 hover:bg-white/10 hover:text-white/70'
                }`
              }
            >
              <span className="text-lg">🎨</span>
              <span className="font-medium">Style Guide</span>
              <Badge size="sm" variant="warning">DEV</Badge>
            </NavLink>
          )}
        </nav>

        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-all duration-200"
        >
          <span className="text-lg">🚪</span>
          <span className="font-medium">Logout</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
