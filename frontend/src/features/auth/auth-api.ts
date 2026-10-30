import { ApiError, apiRequest, type ApiRequestOptions } from '../../lib/api';
import {
  getAccessToken,
  getAuthSnapshot,
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
let loginInFlight: Promise<void> | null = null;
let logoutRevision = -1;
let cookieMutationTail: Promise<void> = Promise.resolve();

class AuthOperationInvalidatedError extends Error {
  constructor() {
    super('Phiên xác thực đã bị thay đổi.');
    this.name = 'AuthOperationInvalidatedError';
  }
}

function assertCurrentRevision(revision: number): void {
  if (revision !== authRevision) throw new AuthOperationInvalidatedError();
}

// Auth requests are never aborted: wait for their response before another request
// can replace the browser-managed HttpOnly cookie. Rejections must not poison FIFO.
function enqueueCookieMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = cookieMutationTail.then(operation);
  cookieMutationTail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
async function readCurrentUser(token: string): Promise<AuthUser> {
  const value = await apiRequest<unknown>('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseMeResponse(value).user;
}

async function rotateSession(): Promise<string> {
  if (logoutInFlight || loginInFlight)
    throw new AuthOperationInvalidatedError();
  if (refreshInFlight) return refreshInFlight;
  const revision = authRevision;
  const operation = enqueueCookieMutation(async () => {
    assertCurrentRevision(revision);
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
  });
  const sharedOperation = operation.finally(() => {
    if (refreshInFlight === sharedOperation) refreshInFlight = null;
  });
  refreshInFlight = sharedOperation;
  return sharedOperation;
}

async function refreshForProtectedRequest(): Promise<string> {
  const revision = authRevision;
  try {
    return await rotateSession();
  } catch (error) {
    assertCurrentRevision(revision);
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
  if (loginInFlight) {
    await loginInFlight.catch(() => undefined);
    return;
  }
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

export function loginWithGoogleIdToken(idToken: string): Promise<void> {
  authRevision += 1;
  const revision = authRevision;
  setAuthRestoring();
  const operation = enqueueCookieMutation(async () => {
    // A newer login/logout may have superseded this queued login before fetch.
    assertCurrentRevision(revision);
    try {
      const value = await apiRequest<unknown>('/api/auth/google', {
        method: 'POST',
        credentials: 'include',
        body: { idToken },
      });
      assertCurrentRevision(revision);
      const response = parseTokenResponse(value);
      const user = await readCurrentUser(response.accessToken);
      assertCurrentRevision(revision);
      setAuthenticated(response.accessToken, user);
    } catch (error) {
      if (
        !(error instanceof AuthOperationInvalidatedError) &&
        revision === authRevision
      )
        setGuest();
      throw error;
    }
  });
  const sharedOperation = operation.finally(() => {
    if (loginInFlight === sharedOperation) loginInFlight = null;
  });
  loginInFlight = sharedOperation;
  return sharedOperation;
}

export function logoutCurrentSession(): Promise<void> {
  if (logoutInFlight && logoutRevision === authRevision) return logoutInFlight;
  authRevision += 1;
  const revision = authRevision;
  logoutRevision = revision;
  setGuest();
  // Even if a later login is queued, finish revocation before sending that login.
  const operation = enqueueCookieMutation(async () => {
    await apiRequest<void>('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
  });
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
// Each caller can stop waiting without cancelling the shared cookie rotation.
function waitWithSignal<T>(
  operation: Promise<T>,
  signal?: AbortSignal | null,
): Promise<T> {
  if (!signal) return operation;
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    void operation.then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', abort);
    });
  });
}

/** Opt-in transport for protected module APIs, not Auth endpoints or public reads. */
export async function protectedApiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  // Reject noncanonical paths before a refresh or sending credentials.
  const pathname = path.split(/[?#]/, 1)[0];
  if (
    !pathname.startsWith('/api/') ||
    /[\\%]/.test(pathname) ||
    pathname
      .split('/')
      .some((segment) => segment === '.' || segment === '..') ||
    pathname === '/api/auth' ||
    pathname.startsWith('/api/auth/')
  ) {
    throw new ApiError('Dùng API client phù hợp cho đường dẫn này.', {
      code: 'INVALID_PROTECTED_API_PATH',
      kind: 'request',
    });
  }
  const revision = authRevision;
  const ownerId = getAuthSnapshot().user?.id;
  const assertActive = () => {
    options.signal?.throwIfAborted();
    assertCurrentRevision(revision);
    if (ownerId !== undefined && getAuthSnapshot().user?.id !== ownerId) {
      throw new AuthOperationInvalidatedError();
    }
  };
  assertActive();

  const refresh = async () => {
    assertActive();
    const token = await waitWithSignal(
      refreshForProtectedRequest(),
      options.signal,
    );
    assertActive();
    return token;
  };
  let token = getAccessToken();
  const refreshedBeforeRequest = !token;
  if (!token) token = await refresh();

  const requestWith = async (accessToken: string) => {
    assertActive();
    try {
      const result = await waitWithSignal(
        apiRequest<T>(path, {
          ...options,
          headers: {
            ...Object.fromEntries(new Headers(options.headers).entries()),
            Authorization: `Bearer ${accessToken}`,
          },
        }),
        options.signal,
      );
      assertActive();
      return result;
    } catch (error) {
      assertActive();
      throw error;
    }
  };

  try {
    return await requestWith(token);
  } catch (error) {
    assertActive();
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    if (refreshedBeforeRequest) {
      setGuest();
      throw error;
    }
    // A concurrent request may already have rotated this session's token.
    const latest = getAccessToken();
    const nextToken = latest && latest !== token ? latest : await refresh();
    try {
      return await requestWith(nextToken);
    } catch (retryError) {
      assertActive();
      if (retryError instanceof ApiError && retryError.status === 401)
        setGuest();
      throw retryError;
    }
  }
}
