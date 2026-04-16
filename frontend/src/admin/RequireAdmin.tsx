import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function RequireAdmin() {
  const { accessToken, user } = useAuthStore();
  const location = useLocation();

  if (!accessToken) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }
  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
