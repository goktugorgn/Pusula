import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/AppShell';
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

// Placeholder pages for now
function SettingsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>
      <div className="glass p-6">
        <p className="text-white/70">Settings page coming soon...</p>
      </div>
    </div>
  );
}

function LogsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Logs</h1>
      <div className="glass p-6">
        <p className="text-white/70">Logs page coming soon...</p>
      </div>
    </div>
  );
}

function AlertsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Alerts</h1>
      <div className="glass p-6">
        <p className="text-white/70">Alerts page coming soon...</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/logs" element={<LogsPage />} />
              <Route path="/alerts" element={<AlertsPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
