import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { HealthCheckPage } from './App';
import { NotFoundPage } from './NotFoundPage';

export const appPaths = {
  home: '/',
  developmentHealth: '/_dev/health',
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
        <Route path={appPaths.notFound} element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
