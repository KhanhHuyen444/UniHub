import { getAuthSnapshot } from '../auth/auth-state';

export function isCurrentProfileSession(
  userId: number,
  signal: AbortSignal,
): boolean {
  const current = getAuthSnapshot();
  return (
    !signal.aborted &&
    current.status === 'authenticated' &&
    current.user?.role === 'Student' &&
    current.user.id === userId
  );
}
