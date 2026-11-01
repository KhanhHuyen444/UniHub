import { AdminLayout } from '../../../layouts/AdminLayout';
import { useAuth } from '../../auth/AuthProvider';
import { RequireRole } from '../../auth/AuthGuard';
import { getAccessToken } from '../../auth/auth-state';
import { AdminCategoriesPage } from './AdminCategoriesPage';

export function AdminCategoriesRoute() {
  const auth = useAuth();
  return (
    <RequireRole role="Admin">
      <AdminLayout activeKey="categories">
        <AdminCategoriesPage
          accessToken={getAccessToken()}
          role={auth.user?.role ?? null}
        />
      </AdminLayout>
    </RequireRole>
  );
}
