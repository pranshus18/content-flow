import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';

/**
 * Single admin gate for all /admin, /users, etc. Stays mounted while navigating
 * between admin pages so "Loading admin access…" does not flash on every click.
 */
export default function AdminRouteLayout() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading, role } = useUserRole();

  const resolvingAccess = authLoading || (Boolean(user) && roleLoading && role === null);

  if (resolvingAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading admin access...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
