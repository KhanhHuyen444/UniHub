import { BrowserRouter, Route, Routes, useNavigate } from 'react-router';
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
import { StudentLayout } from '../layouts/StudentLayout';
import { AdminLayout } from '../layouts/AdminLayout';
import { AdminOpportunitiesPage } from '../features/admin/opportunities/AdminOpportunitiesPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { ProfileSavedNotice } from '../features/profile/ProfileSavedNotice';
import { RecommendationsPage } from '../features/recommendations/RecommendationsPage';
import { useAuth } from '../features/auth/AuthProvider';
import { getAccessToken } from '../features/auth/auth-state';
import { AdminDashboardPage } from '../features/admin/dashboard/AdminDashboardPage';
import { CalendarPage } from '../features/calendar/CalendarPage';
import { HomePage } from '../features/home/HomePage';

function RecommendationsRoute() {
  const { user } = useAuth();
  const navigate = useNavigate();
  return (
    <RecommendationsPage
      accessToken={getAccessToken()}
      role={user?.role ?? null}
      onCompleteProfile={() => navigate('/profile')}
      onSignIn={() => navigate('/login?returnTo=%2Frecommendations')}
    />
  );
}

export const appPaths = {
  home: '/',
  developmentHealth: '/_dev/health',
  sharedUiPreview: sharedUiPreviewPath,
  opportunities: '/opportunities',
  roadmaps: '/roadmaps',
  profile: '/profile',
  recommendations: '/recommendations',
  calendar: '/calendar',
  adminOpportunities: '/admin/opportunities',
  adminDashboard: '/admin/dashboard',
  notFound: '/404',
} as const;

export function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProfileSavedNotice />
        <Routes>
          <Route
            path={appPaths.home}
            element={
              <PublicLayout activeKey="home">
                <HomePage />
              </PublicLayout>
            }
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
            path={appPaths.calendar}
            element={
              <RequireRole role="Student">
                <CalendarPage />
              </RequireRole>
            }
          />
          <Route
            path={appPaths.profile}
            element={
              <RequireRole role="Student">
                <StudentLayout activeKey="profile">
                  <ProfilePage />
                </StudentLayout>
              </RequireRole>
            }
          />
          <Route
            path={appPaths.recommendations}
            element={
              <RequireRole role="Student">
                <StudentLayout activeKey="recommendations">
                  <RecommendationsRoute />
                </StudentLayout>
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
