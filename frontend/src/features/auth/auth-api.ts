import { ApiError, apiRequest, type ApiRequestOptions } from '../../lib/api';
import {
  getAccessToken,
  setAuthRestoring,
  setAuthUnavailable,
  setAuthenticated,
  setGuest,
  type AuthRole,
  type AuthUser,
} from './auth-state';

interface TokenResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

interface LoginOrRefreshResponse extends TokenResponse {
  user: AuthUser;
}

interface MeResponse {
  user: AuthUser;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseUser(value: unknown): AuthUser {
  if (
    !isRecord(value) ||
    !Number.isSafeInteger(value.id) ||
    typeof value.email !== 'string' ||
    typeof value.fullName !== 'string' ||
    !(typeof value.avatarUrl === 'string' || value.avatarUrl === null) ||
    (value.role !== 'Student' && value.role !== 'Admin')
  ) {
    throw new ApiError('Máy chủ trả về hồ sơ không hợp lệ.', {
      code: 'INVALID_RESPONSE',
      kind: 'response',
    });
  }
  return {
    id: value.id as number,
    email: value.email,
    fullName: value.fullName,
    avatarUrl: value.avatarUrl,
    role: value.role as AuthRole,
  };
}

function parseTokenResponse(value: unknown): LoginOrRefreshResponse {
  if (
    !isRecord(value) ||
    typeof value.accessToken !== 'string' ||
    !value.accessToken ||
    value.tokenType !== 'Bearer' ||
    !Number.isInteger(value.expiresIn) ||
    (value.expiresIn as number) <= 0 ||
    (value.expiresIn as number) > 900
  ) {
    throw new ApiError('Máy chủ trả về phiên không hợp lệ.', {
      code: 'INVALID_RESPONSE',
      kind: 'response',
    });
  }
  return {
    accessToken: value.accessToken,
    tokenType: 'Bearer',
    expiresIn: value.expiresIn as number,
    user: parseUser(value.user),
  };
}

function parseMeResponse(value: unknown): MeResponse {
  if (!isRecord(value)) {
    throw new ApiError('Máy chủ trả về hồ sơ không hợp lệ.', {
      code: 'INVALID_RESPONSE',
      kind: 'response',
    });
  }
  return { user: parseUser(value.user) };
}

let refreshInFlight: Promise<string> | null = null;
let restoreInFlight: Promise<void> | null = null;
let logoutInFlight: Promise<void> | null = null;
let authRevision = 0;
const pendingCookieMutations = new Set<Promise<unknown>>();

class AuthOperationInvalidatedError extends Error {
  constructor() {
    super('Phiên xác thực đã bị thay đổi.');
    this.name = 'AuthOperationInvalidatedError';
  }
}

function assertCurrentRevision(revision: number): void {
  if (revision !== authRevision) throw new AuthOperationInvalidatedError();
}

function trackCookieMutation<T>(operation: Promise<T>): Promise<T> {
  pendingCookieMutations.add(operation);
  void operation.then(
    () => pendingCookieMutations.delete(operation),
    () => pendingCookieMutations.delete(operation),
  );
  return operation;
}

async function readCurrentUser(token: string): Promise<AuthUser> {
  const value = await apiRequest<unknown>('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseMeResponse(value).user;
}

async function rotateSession(): Promise<string> {
  if (logoutInFlight) throw new AuthOperationInvalidatedError();
  if (refreshInFlight) return refreshInFlight;
  const revision = authRevision;
  const operation = trackCookieMutation(
    (async () => {
      const value = await apiRequest<unknown>('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      assertCurrentRevision(revision);
      const response = parseTokenResponse(value);
      const user = await readCurrentUser(response.accessToken);
      assertCurrentRevision(revision);
      setAuthenticated(response.accessToken, user);
      return response.accessToken;
    })(),
  );
  const sharedOperation = operation.finally(() => {
    if (refreshInFlight === sharedOperation) refreshInFlight = null;
  });
  refreshInFlight = sharedOperation;
  return sharedOperation;
}

async function refreshForProtectedRequest(): Promise<string> {
  try {
    return await rotateSession();
  } catch (error) {
    if (error instanceof AuthOperationInvalidatedError) throw error;
    if (error instanceof ApiError && error.status === 401) {
      setGuest();
    } else {
      setAuthUnavailable(
        error instanceof ApiError
          ? error.message
          : 'Không thể làm mới phiên UniHub.',
      );
    }
    throw error;
  }
}

export async function restoreAuthSession(): Promise<void> {
  if (logoutInFlight) {
    await logoutInFlight.catch(() => undefined);
    return;
  }
  if (restoreInFlight) return restoreInFlight;
  const revision = authRevision;
  setAuthRestoring();
  restoreInFlight = (async () => {
    try {
      await rotateSession();
    } catch (error) {
      if (
        error instanceof AuthOperationInvalidatedError ||
        revision !== authRevision
      ) {
        return;
      }
      if (error instanceof ApiError && error.status === 401) {
        setGuest();
      } else {
        setAuthUnavailable(
          error instanceof ApiError
            ? error.message
            : 'Không thể khôi phục phiên UniHub.',
        );
      }
    }
  })().finally(() => {
    restoreInFlight = null;
  });
  return restoreInFlight;
}

export async function loginWithGoogleIdToken(idToken: string): Promise<void> {
  if (logoutInFlight) await logoutInFlight.catch(() => undefined);
  const revision = authRevision;
  const loginOperation = trackCookieMutation(
    apiRequest<unknown>('/api/auth/google', {
      method: 'POST',
      credentials: 'include',
      body: { idToken },
    }),
  );
  try {
    const value = await loginOperation;
    assertCurrentRevision(revision);
    const response = parseTokenResponse(value);
    const user = await readCurrentUser(response.accessToken);
    assertCurrentRevision(revision);
    setAuthenticated(response.accessToken, user);
  } catch (error) {
    if (
      !(error instanceof AuthOperationInvalidatedError) &&
      revision === authRevision
    ) {
      setGuest();
    }
    throw error;
  }
}

export async function logoutCurrentSession(): Promise<void> {
  if (logoutInFlight) return logoutInFlight;
  authRevision += 1;
  const revision = authRevision;
  setGuest();
  const operation = (async () => {
    // Drain refresh/login responses first so logout uses the latest cookie.
    while (pendingCookieMutations.size > 0) {
      await Promise.allSettled([...pendingCookieMutations]);
    }
    assertCurrentRevision(revision);
    await apiRequest<void>('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
  })();
  const sharedOperation = operation
    .catch((error: unknown) => {
      if (revision === authRevision) {
        setGuest(
          'Đã đăng xuất trên thiết bị này; máy chủ chưa xác nhận thu hồi phiên.',
        );
      }
      throw error;
    })
    .finally(() => {
      if (logoutInFlight === sharedOperation) logoutInFlight = null;
    });
  logoutInFlight = sharedOperation;
  return sharedOperation;
}

export async function protectedApiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const revision = authRevision;
  let token = getAccessToken();
  if (!token) token = await refreshForProtectedRequest();

  const requestWith = (accessToken: string) =>
    apiRequest<T>(path, {
      ...options,
      headers: {
        ...Object.fromEntries(new Headers(options.headers).entries()),
        Authorization: `Bearer ${accessToken}`,
      },
    });

  try {
    return await requestWith(token);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    const latest = getAccessToken();
    if (latest && latest !== token) {
      try {
        assertCurrentRevision(revision);
        const result = await requestWith(latest);
        assertCurrentRevision(revision);
        return result;
      } catch (retryError) {
        if (
          retryError instanceof ApiError &&
          retryError.status === 401 &&
          revision === authRevision
        ) {
          setGuest();
        }
        throw retryError;
      }
    }
    const refreshedToken = await refreshForProtectedRequest();
    try {
      assertCurrentRevision(revision);
      const result = await requestWith(refreshedToken);
      assertCurrentRevision(revision);
      return result;
    } catch (retryError) {
      if (
        retryError instanceof ApiError &&
        retryError.status === 401 &&
        revision === authRevision
      ) {
        setGuest();
      }
      throw retryError;
    }
  }
}
