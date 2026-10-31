import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import { ErrorState, LoadingState } from '../../components/ui';
import { loginDestination } from '../auth/return-path';
import { getProfile } from './api';
import { isCurrentProfileSession } from './session';

// Completeness is checked only at login, never as a global Student route gate.
export function ProfileLoginRedirect({
  userId,
  returnTo,
}: {
  userId: number;
  returnTo: string | null;
}) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<'loading' | 'error' | boolean>('loading');
  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    getProfile(controller.signal).then(
      ({ isComplete }) => {
        if (isCurrentProfileSession(userId, controller.signal))
          setState(isComplete);
      },
      () => {
        if (isCurrentProfileSession(userId, controller.signal))
          setState('error');
      },
    );
    return () => controller.abort();
  }, [userId, attempt]);
  if (state === 'error')
    return (
      <ErrorState
        title="Không kiểm tra được hồ sơ"
        description="Vui lòng thử lại để tiếp tục đăng nhập."
        onRetry={() => setAttempt((value) => value + 1)}
      />
    );
  if (state === 'loading') return <LoadingState title="Đang kiểm tra hồ sơ" />;
  return (
    <Navigate
      to={
        state
          ? loginDestination(returnTo, 'Student', window.location.origin)
          : '/profile'
      }
      replace
    />
  );
}
