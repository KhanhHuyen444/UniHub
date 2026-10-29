import { useCallback, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { ApiError } from '../../lib/api';
import { useAuth } from './AuthProvider';
import { GoogleIdentityButton } from './GoogleIdentityButton';
import { safeReturnPath } from './return-path';

export function LoginPage() {
  const { status, user, error: authError, loginWithGoogleIdToken } = useAuth();
  const [query] = useSearchParams();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const returnPath = safeReturnPath(
    query.get('returnTo'),
    window.location.origin,
  );

  const acceptCredential = useCallback(
    async (credential: string) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);
      setError(null);
      try {
        await loginWithGoogleIdToken(credential);
        navigate(returnPath, { replace: true });
      } catch (loginError) {
        setError(
          loginError instanceof ApiError
            ? loginError.message
            : 'Không thể đăng nhập UniHub. Vui lòng thử lại.',
        );
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [loginWithGoogleIdToken, navigate, returnPath],
  );

  if (status === 'authenticated' && user) {
    return <Navigate to={returnPath} replace />;
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-160px)] max-w-public items-center justify-center px-8 py-12">
      <section className="w-full max-w-xl rounded-card border border-line bg-white p-8 shadow-card">
        <Link
          to="/opportunities"
          className="type-label font-medium text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          ← Quay lại Hub cơ hội
        </Link>
        <h1 className="mt-8 type-heading text-ink">Đăng nhập UniHub</h1>
        <p className="mt-3 type-body text-secondary">
          Dùng tài khoản Google để tiếp tục. UniHub xác minh thông tin đăng nhập
          ở máy chủ.
        </p>
        <div className="mt-7">
          <GoogleIdentityButton
            onCredential={acceptCredential}
            disabled={submitting}
          />
        </div>
        {submitting ? (
          <p
            role="status"
            aria-live="polite"
            className="mt-4 type-label text-secondary"
          >
            Đang xác minh tài khoản…
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-4 type-label text-danger">
            {error}
          </p>
        ) : null}
        {status === 'unavailable' || authError ? (
          <div className="mt-5 rounded-control border border-line bg-page p-4">
            <p role="status" className="type-label text-secondary">
              {authError ??
                'Dịch vụ xác thực chưa sẵn sàng. Bạn vẫn có thể thử đăng nhập lại.'}
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
