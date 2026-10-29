import { ApiError, apiRequest, type ApiRequestOptions } from '../../lib/api';
import {
  getAccessToken,
  setAccessToken,
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

async function readCurrentUser(token: string): Promise<AuthUser> {
  const value = await apiRequest<unknown>('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseMeResponse(value).user;
}

async function rotateSession(): Promise<string> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const value = await apiRequest<unknown>('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    const response = parseTokenResponse(value);
    setAccessToken(response.accessToken);
    const user = await readCurrentUser(response.accessToken);
    setAuthenticated(response.accessToken, user);
    return response.accessToken;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function refreshForProtectedRequest(): Promise<string> {
  try {
    return await rotateSession();
  } catch (error) {
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
  if (restoreInFlight) return restoreInFlight;
  setAuthRestoring();
  restoreInFlight = (async () => {
    try {
      await rotateSession();
    } catch (error) {
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
  const value = await apiRequest<unknown>('/api/auth/google', {
    method: 'POST',
    credentials: 'include',
    body: { idToken },
  });
  const response = parseTokenResponse(value);
  setAccessToken(response.accessToken);
  try {
    const user = await readCurrentUser(response.accessToken);
    setAuthenticated(response.accessToken, user);
  } catch (error) {
    setGuest();
    throw error;
  }
}

export async function logoutCurrentSession(): Promise<void> {
  setGuest();
  try {
    await apiRequest<void>('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    setGuest(
      'Đã đăng xuất trên thiết bị này; máy chủ chưa xác nhận thu hồi phiên.',
    );
    throw error;
  }
}

export async function protectedApiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
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
        return await requestWith(latest);
      } catch (retryError) {
        if (retryError instanceof ApiError && retryError.status === 401) {
          setGuest();
        }
        throw retryError;
      }
    }
    try {
      return await requestWith(await refreshForProtectedRequest());
    } catch (refreshError) {
      throw refreshError;
    }
  }
}
