import { BrowserRouter, Route, Routes } from 'react-router';
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
import { PendingFeatureNotice } from '../features/auth/PendingFeatureNotice';
import { PublicLayout } from '../layouts/PublicLayout';
import { StudentLayout } from '../layouts/StudentLayout';
import { AdminLayout } from '../layouts/AdminLayout';
import { AdminOpportunitiesPage } from '../features/admin/opportunities/AdminOpportunitiesPage';
import { AdminDashboardPage } from '../features/admin/dashboard/AdminDashboardPage';
import { CalendarPage } from '../features/calendar/CalendarPage';
import { HomePage } from '../features/home/HomePage';

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
                  <PendingFeatureNotice
                    title="Hồ sơ sinh viên"
                    description="Tính năng Hồ sơ sinh viên đang trong quá trình nghiệm thu tích hợp (PR #36). Bạn có thể quay lại khám phá các cơ hội học tập và việc làm."
                    badgeText="Chờ tích hợp PR #36"
                    backTo={appPaths.opportunities}
                    backLabel="Khám phá cơ hội"
                  />
                </StudentLayout>
              </RequireRole>
            }
          />
          <Route
            path={appPaths.recommendations}
            element={
              <RequireRole role="Student">
                <StudentLayout activeKey="recommendations">
                  <PendingFeatureNotice
                    title="Cơ hội dành cho bạn"
                    description="Tính năng gợi ý cơ hội học tập và việc làm cá nhân hóa đang được hoàn thiện. Vui lòng quay lại sau hoặc duyệt danh sách cơ hội hiện có."
                    badgeText="Đang hoàn thiện"
                    backTo={appPaths.opportunities}
                    backLabel="Xem tất cả cơ hội"
                  />
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
