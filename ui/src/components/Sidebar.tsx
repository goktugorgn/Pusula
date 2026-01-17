/**
 * Sidebar navigation
 */

import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Network,
  FlaskConical,
  Bell,
  Settings,
  LogOut,
  Compass,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/upstreams', label: 'Upstreams', icon: Network },
  { path: '/self-test', label: 'Self-Test', icon: FlaskConical },
  { path: '/alerts', label: 'Alerts', icon: Bell },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const { logout } = useAuth();
  const location = useLocation();

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-4 left-4 z-40 lg:hidden p-2 glass rounded-lg"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 z-50
          glass border-r border-slate-700/50
          transform transition-transform duration-300
          lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Mobile close button */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 lg:hidden text-slate-400 hover:text-slate-200"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-slate-700/50">
          <div className="p-2 bg-blue-600/20 rounded-lg border border-blue-500/30">
            <Compass className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-slate-100">Pusula</h1>
            <p className="text-xs text-slate-500">DNS Management</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl
                  transition-all duration-200
                  ${isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-4 py-4 border-t border-slate-700/50">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl
                       text-slate-400 hover:text-red-400 hover:bg-red-500/10
                       transition-all duration-200"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
