/**
 * Protected Route - Route guard with auth check
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../api/auth';

export default function ProtectedRoute() {
  const { isAuthenticated, checkAuth } = useAuth();
  const location = useLocation();

  // Double-check auth status (in-memory + localStorage)
  const isAuthed = isAuthenticated || checkAuth();

  if (!isAuthed) {
    // Redirect to login, preserving the intended destination
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
