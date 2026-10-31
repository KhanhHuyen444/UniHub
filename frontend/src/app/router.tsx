import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { HealthCheckPage } from './App';
import { NotFoundPage } from './NotFoundPage';
import { SharedUiPreviewPage } from './SharedUiPreviewPage';
import { sharedUiPreviewPath } from '../layouts/navigation';
import { OpportunityHubPage } from '../features/opportunities/OpportunityHubPage';
import { OpportunityDetailPage } from '../features/opportunities/OpportunityDetailPage';
import { ForumHubPage } from '../features/forum/ForumHubPage';
import { ForumPostDetailPage } from '../features/forum/ForumPostDetailPage';
import { AdminForumModerationPage } from '../features/admin/forum/ForumModerationPage';

export const appPaths = {
  home: '/',
  developmentHealth: '/_dev/health',
  sharedUiPreview: sharedUiPreviewPath,
  opportunities: '/opportunities',
  forum: '/forum',
  adminForumModeration: '/admin/moderation',
  notFound: '/404',
} as const;

export function AppRouter() {
  return (
    <BrowserRouter>
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
        <Route path={appPaths.opportunities} element={<OpportunityHubPage />} />
        <Route
          path={`${appPaths.opportunities}/:id`}
          element={<OpportunityDetailPage />}
        />
        <Route path={appPaths.forum} element={<ForumHubPage />} />
        <Route
          path={`${appPaths.forum}/:id`}
          element={<ForumPostDetailPage />}
        />
        <Route
          path={appPaths.adminForumModeration}
          element={<AdminForumModerationPage />}
        />
        <Route path={appPaths.notFound} element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
