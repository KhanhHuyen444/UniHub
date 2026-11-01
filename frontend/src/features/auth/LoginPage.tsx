import { useCallback, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { ApiError } from '../../lib/api';
import { useAuth } from './AuthProvider';
import { GoogleIdentityButton } from './GoogleIdentityButton';
import { loginDestination } from './return-path';
import { ProfileLoginRedirect } from '../profile/ProfileLoginRedirect';

import { LoginPresentation } from './LoginPresentation';

export function LoginPage() {
  const { status, user, error: authError, loginWithGoogleIdToken } = useAuth();
  const [query] = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const returnTo = query.get('returnTo');
  const returnPath = loginDestination(
    returnTo,
    user?.role ?? null,
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
    [loginWithGoogleIdToken],
  );

  if (status === 'authenticated' && user) {
    if (user.role === 'Student')
      return (
        <ProfileLoginRedirect
          key={user.id}
          userId={user.id}
          returnTo={returnTo}
        />
      );
    return <Navigate to={returnPath} replace />;
  }

  return (
    <LoginPresentation
      googleButton={
        <GoogleIdentityButton
          onCredential={acceptCredential}
          disabled={submitting || status === 'restoring'}
          width={270}
        />
      }
      submitting={submitting}
      restoring={status === 'restoring'}
      error={error}
      authError={
        authError ??
        (status === 'unavailable'
          ? 'Dịch vụ xác thực chưa sẵn sàng. Bạn vẫn có thể thử đăng nhập lại.'
          : null)
      }
    />
  );
}
