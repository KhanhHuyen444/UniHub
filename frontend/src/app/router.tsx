import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { HealthCheckPage } from './App';
import { NotFoundPage } from './NotFoundPage';
import { SharedUiPreviewPage } from './SharedUiPreviewPage';
import { sharedUiPreviewPath } from '../layouts/navigation';
import { OpportunityHubPage } from '../features/opportunities/OpportunityHubPage';
import { OpportunityDetailPage } from '../features/opportunities/OpportunityDetailPage';

export const appPaths = {
  home: '/',
  developmentHealth: '/_dev/health',
  sharedUiPreview: sharedUiPreviewPath,
  opportunities: '/opportunities',
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
        <Route path={appPaths.notFound} element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
