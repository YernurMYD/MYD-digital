import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { UserRole } from '../../types/auth';

interface RoleRouteProps {
  allowed: UserRole[];
}

export default function RoleRoute({ allowed }: RoleRouteProps) {
  const { user, isLoading, hasRole } = useAuth();

  if (isLoading) {
    return (
      <div className="route-loader">
        <div className="route-loader__spinner" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!hasRole(...allowed)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
