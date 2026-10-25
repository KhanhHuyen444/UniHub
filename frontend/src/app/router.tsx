import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { HealthCheckPage } from './App';
import { NotFoundPage } from './NotFoundPage';
import { SharedUiPreviewPage } from './SharedUiPreviewPage';
import { sharedUiPreviewPath } from '../layouts/navigation';

export const appPaths = {
  home: '/',
  developmentHealth: '/_dev/health',
  sharedUiPreview: sharedUiPreviewPath,
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
        <Route path={appPaths.notFound} element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
