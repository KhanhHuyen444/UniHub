import type { AuthRole, AuthStatus } from './auth-state';

export type RoleGateState =
  | 'pending'
  | 'unavailable'
  | 'login'
  | 'forbidden'
  | 'allow';

export function roleGateState(
  status: AuthStatus,
  userRole: AuthRole | null,
  requiredRole: AuthRole,
): RoleGateState {
  if (status === 'restoring') return 'pending';
  if (status === 'unavailable') return 'unavailable';
  if (status !== 'authenticated' || userRole === null) return 'login';
  return userRole === requiredRole ? 'allow' : 'forbidden';
}
