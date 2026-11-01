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
  status: AuthStatus;
  user: AuthUser | null;
  error: string | null;
}

const listeners = new Set<() => void>();
let accessToken: string | null = null;
let snapshot: AuthSnapshot = {
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
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function setAuthenticated(token: string, user: AuthUser): void {
  accessToken = token;
  publish({ status: 'authenticated', user, error: null });
}

export function setGuest(error: string | null = null): void {
  accessToken = null;
  publish({ status: 'guest', user: null, error });
}

export function setAuthUnavailable(message: string): void {
  accessToken = null;
  publish({ status: 'unavailable', user: null, error: message });
}

export function setAuthRestoring(): void {
  accessToken = null;
  publish({ status: 'restoring', user: null, error: null });
}
