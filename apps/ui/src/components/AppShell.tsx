/**
 * App Shell Layout
 */

import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useLogout } from '../api';

export default function AppShell() {
  const navigate = useNavigate();
  const logout = useLogout();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => navigate('/login'),
    });
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/upstreams', label: 'Upstreams', icon: '🌐' },
    { path: '/self-test', label: 'Self-Test', icon: '🔍' },
    { path: '/logs', label: 'Logs', icon: '📋' },
    { path: '/alerts', label: 'Alerts', icon: '🔔' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 glass-dark p-4 flex flex-col">
        <div className="text-xl font-bold text-white mb-8 px-4">
          Pusula
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map(({ path, label, icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <span>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        >
          <span>🚪</span>
          <span>Logout</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
