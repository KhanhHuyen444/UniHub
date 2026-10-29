import { Navigate, useLocation } from 'react-router';
import { LoadingState } from '../../components/ui/FeedbackStates';
import { useAuth } from './AuthProvider';
import type { AuthRole } from './auth-state';
import { roleGateState } from './role-access';

export function RequireRole({
  role,
  children,
}: {
  role: AuthRole;
  children: React.ReactNode;
}) {
  const { status, user, retryRestore } = useAuth();
  const location = useLocation();
  const access = roleGateState(status, user?.role ?? null, role);

  if (access === 'pending') {
    return <LoadingState title="Đang khôi phục phiên…" />;
  }
  if (access === 'unavailable') {
    return (
      <main className="mx-auto max-w-public px-8 py-16">
        <section
          role="alert"
          className="rounded-card border border-line bg-white p-8"
        >
          <h1 className="type-heading text-ink">
            Chưa kiểm tra được quyền truy cập
          </h1>
          <p className="mt-3 type-body text-secondary">
            Dịch vụ xác thực tạm thời chưa sẵn sàng. Thử lại trước khi tiếp tục.
          </p>
          <button
            type="button"
            onClick={() => void retryRestore()}
            className="mt-5 rounded-control bg-brand px-5 py-3 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Thử lại
          </button>
        </section>
      </main>
    );
  }
  if (access === 'login') {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return (
      <Navigate
        to={`/login?returnTo=${encodeURIComponent(returnTo)}`}
        replace
        state={{ from: location }}
      />
    );
  }
  if (access === 'forbidden') return <Navigate to="/403" replace />;
  return children;
}

export function ForbiddenPage() {
  return (
    <div className="mx-auto max-w-public px-8 py-16">
      <section className="rounded-card border border-line bg-white p-8">
        <h1 className="type-heading text-ink">Bạn không có quyền truy cập</h1>
        <p className="mt-3 type-body text-secondary">
          Tài khoản hiện tại không có vai trò cần thiết cho trang này.
        </p>
      </section>
    </div>
  );
}
