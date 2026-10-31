import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from 'react-router';
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
import { ProfilePage } from '../features/profile/ProfilePage';
import { StudentLayout } from '../layouts/StudentLayout';
import { RecommendationsPage } from '../features/recommendations/RecommendationsPage';
import { useAuth } from '../features/auth/AuthProvider';
import { getAccessToken } from '../features/auth/auth-state';

function RecommendationsRoute() {
  const { user } = useAuth();
  const navigate = useNavigate();
  return (
    <RecommendationsPage
      accessToken={getAccessToken()}
      role={user?.role ?? null}
      onCompleteProfile={() => navigate('/profile?returnTo=%2Frecommendations')}
      onSignIn={() => navigate('/login?returnTo=%2Frecommendations')}
    />
  );
}

export const appPaths = {
  home: '/',
  profile: '/profile',
  developmentHealth: '/_dev/health',
  sharedUiPreview: sharedUiPreviewPath,
  opportunities: '/opportunities',
  roadmaps: '/roadmaps',
  adminOpportunities: '/admin/opportunities',
  notFound: '/404',
} as const;

export function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/recommendations"
            element={
              <RequireRole role="Student">
                <StudentLayout activeKey="recommendations">
                  <RecommendationsRoute />
                </StudentLayout>
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
