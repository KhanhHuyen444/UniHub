import { RecommendationsPage } from '../recommendations/RecommendationsPage';
import { AdminCategoriesPage } from '../admin/categories/AdminCategoriesPage';
import { useAuth } from './AuthProvider';

export function RecommendationsRoute() {
  const { accessToken, role, user, status, logout } = useAuth();
  if (
    status !== 'authenticated' ||
    role !== 'Student' ||
    !accessToken ||
    !user
  ) {
    return null;
  }
  return (
    <RecommendationsPage
      key={user.id}
      accessToken={accessToken}
      role={role}
      // Clear the expired local session; RequireRole preserves the return path.
      onSignIn={() => {
        void logout().catch(() => undefined);
      }}
      // Profile has no product route yet. Keep the page's honest 409 guidance.
    />
  );
}

export function AdminCategoriesRoute() {
  const { accessToken, role, user, status } = useAuth();
  if (status !== 'authenticated' || role !== 'Admin' || !accessToken || !user) {
    return null;
  }
  return (
    <AdminCategoriesPage key={user.id} accessToken={accessToken} role={role} />
  );
}
