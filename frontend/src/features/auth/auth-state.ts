export type AuthRole = 'Student' | 'Admin';

export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  role: AuthRole;
}

export type AuthStatus =
  | 'restoring'
  | 'guest'
  | 'authenticated'
  | 'unavailable';

export interface AuthSnapshot {
  accessToken: string | null;
  role: AuthRole | null;
  status: AuthStatus;
  user: AuthUser | null;
  error: string | null;
}

const listeners = new Set<() => void>();
let snapshot: AuthSnapshot = {
  accessToken: null,
  role: null,
  status: 'restoring',
  user: null,
  error: null,
};

export function getAuthSnapshot(): AuthSnapshot {
  return snapshot;
}

export function subscribeToAuth(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function publish(next: AuthSnapshot): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

export function getAccessToken(): string | null {
  return snapshot.accessToken;
}

export function setAuthenticated(token: string, user: AuthUser): void {
  publish({
    accessToken: token,
    role: user.role,
    status: 'authenticated',
    user,
    error: null,
  });
}

export function setGuest(error: string | null = null): void {
  publish({
    accessToken: null,
    role: null,
    status: 'guest',
    user: null,
    error,
  });
}

export function setAuthUnavailable(message: string): void {
  publish({
    accessToken: null,
    role: null,
    status: 'unavailable',
    user: null,
    error: message,
  });
}

export function setAuthRestoring(): void {
  publish({
    accessToken: null,
    role: null,
    status: 'restoring',
    user: null,
    error: null,
  });
}
