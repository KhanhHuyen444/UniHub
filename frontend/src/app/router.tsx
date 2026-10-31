import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { HealthCheckPage } from './App';
import { NotFoundPage } from './NotFoundPage';
import { SharedUiPreviewPage } from './SharedUiPreviewPage';
import { sharedUiPreviewPath } from '../layouts/navigation';
import { OpportunityHubPage } from '../features/opportunities/OpportunityHubPage';
import { OpportunityDetailPage } from '../features/opportunities/OpportunityDetailPage';
import { GuidanceRoadmapPage } from '../features/guidance/GuidanceRoadmapPage';
import { GuidanceDetailPage } from '../features/guidance/GuidanceDetailPage';
import { AuthProvider } from '../features/auth/AuthProvider';
import { ForbiddenPage, RequireRole } from '../features/auth/AuthGuard';
import { LoginPage } from '../features/auth/LoginPage';
import { PublicLayout } from '../layouts/PublicLayout';
import { AdminLayout } from '../layouts/AdminLayout';
import { AdminOpportunitiesPage } from '../features/admin/opportunities/AdminOpportunitiesPage';
import { AdminCategoriesRoute } from '../features/admin/categories/AdminCategoriesRoute';
import { AdminDashboardPage } from '../features/admin/dashboard/AdminDashboardPage';
import { CalendarPage } from '../features/calendar/CalendarPage';

export const appPaths = {
  home: '/',
  developmentHealth: '/_dev/health',
  sharedUiPreview: sharedUiPreviewPath,
  opportunities: '/opportunities',
  roadmaps: '/roadmaps',
  adminOpportunities: '/admin/opportunities',
  adminDashboard: '/admin/dashboard',
  notFound: '/404',
} as const;

export function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path={appPaths.home}
            element={<Navigate to={appPaths.developmentHealth} replace />}
          />
          <Route
            path={appPaths.developmentHealth}
            element={<HealthCheckPage />}
          />
          <Route
            path={appPaths.sharedUiPreview}
            element={<SharedUiPreviewPage />}
          />
          <Route
            path={appPaths.opportunities}
            element={<OpportunityHubPage />}
          />
          <Route
            path={`${appPaths.opportunities}/:id`}
            element={<OpportunityDetailPage />}
          />
          <Route path={appPaths.roadmaps} element={<GuidanceRoadmapPage />} />
          <Route path="/admin/categories" element={<AdminCategoriesRoute />} />
          <Route
            path={appPaths.adminDashboard}
            element={
              <RequireRole role="Admin">
                <AdminLayout activeKey="dashboard">
                  <AdminDashboardPage />
                </AdminLayout>
              </RequireRole>
            }
          />
          <Route
            path="/calendar"
            element={
              <RequireRole role="Student">
                <CalendarPage />
              </RequireRole>
            }
          />
          <Route
            path={`${appPaths.roadmaps}/:id`}
            element={<GuidanceDetailPage />}
          />
          <Route
            path={appPaths.adminOpportunities}
            element={
              <RequireRole role="Admin">
                <AdminLayout activeKey="moderation">
                  <AdminOpportunitiesPage />
                </AdminLayout>
              </RequireRole>
            }
          />
          <Route
            path={`${appPaths.adminOpportunities}/:id`}
            element={
              <RequireRole role="Admin">
                <AdminLayout activeKey="moderation">
                  <AdminOpportunitiesPage />
                </AdminLayout>
              </RequireRole>
            }
          />
          <Route path={appPaths.notFound} element={<NotFoundPage />} />
          <Route
            path="/login"
            element={
              <PublicLayout activeKey="home">
                <LoginPage />
              </PublicLayout>
            }
          />
          <Route
            path="/403"
            element={
              <PublicLayout activeKey="home">
                <ForbiddenPage />
              </PublicLayout>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
