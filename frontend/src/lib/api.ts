export type ApiMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export type ApiErrorKind = 'request' | 'http' | 'network' | 'response';

export class ApiError extends Error {
  readonly code: string;
  readonly kind: ApiErrorKind;
  readonly status?: number;

  constructor(
    message: string,
    options: { code: string; kind: ApiErrorKind; status?: number },
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = options.code;
    this.kind = options.kind;
    this.status = options.status;
  }
}

export type ApiRequestOptions = Omit<RequestInit, 'method' | 'body'> & {
  method?: ApiMethod;
  body?: unknown;
  query?: URLSearchParams;
};

type JsonErrorEnvelope = {
  error?: {
    code?: unknown;
    message?: unknown;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase();
  return (
    mediaType === 'application/json' || Boolean(mediaType?.endsWith('+json'))
  );
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  );
}

function throwNetworkError(error: unknown): never {
  if (isAbortError(error)) throw error;
  throw new ApiError('Không thể kết nối tới máy chủ UniHub.', {
    code: 'NETWORK_ERROR',
    kind: 'network',
  });
}

function parseErrorEnvelope(value: unknown): {
  code: string;
  message: string;
} | null {
  if (!isRecord(value) || !isRecord(value.error)) return null;
  const envelope = value as JsonErrorEnvelope;
  const code = envelope.error?.code;
  const message = envelope.error?.message;
  if (typeof code !== 'string' || typeof message !== 'string') return null;
  return { code, message };
}

export function createApiClient(fetcher: typeof fetch = globalThis.fetch) {
  return async function apiRequest<T>(
    path: string,
    options: ApiRequestOptions = {},
  ): Promise<T> {
    if (path !== '/api' && !path.startsWith('/api/')) {
      throw new ApiError('Đường dẫn API phải bắt đầu bằng /api.', {
        code: 'INVALID_API_PATH',
        kind: 'request',
      });
    }

    const { method = 'GET', body, query, headers, ...requestOptions } = options;
    if (method === 'GET' && body !== undefined) {
      throw new ApiError('Yêu cầu GET không nhận JSON body.', {
        code: 'INVALID_REQUEST_BODY',
        kind: 'request',
      });
    }

    const queryString = query?.toString();
    const requestPath = queryString
      ? `${path}${path.includes('?') ? '&' : '?'}${queryString}`
      : path;
    const requestHeaders = new Headers(headers);
    if (!requestHeaders.has('Accept')) {
      requestHeaders.set('Accept', 'application/json');
    }

    let serializedBody: string | undefined;
    if (body !== undefined) {
      try {
        const encodedBody = JSON.stringify(body);
        if (encodedBody === undefined) throw new TypeError('No JSON value');
        serializedBody = encodedBody;
      } catch {
        throw new ApiError('Dữ liệu gửi lên không thể chuyển thành JSON.', {
          code: 'INVALID_REQUEST_BODY',
          kind: 'request',
        });
      }
      if (!requestHeaders.has('Content-Type')) {
        requestHeaders.set('Content-Type', 'application/json');
      }
    }

    let response: Response;
    try {
      response = await fetcher(requestPath, {
        ...requestOptions,
        method,
        headers: requestHeaders,
        body: serializedBody,
      });
    } catch (error) {
      return throwNetworkError(error);
    }

    let responseText: string;
    try {
      responseText = await response.text();
    } catch (error) {
      return throwNetworkError(error);
    }

    const hasBody = responseText.trim().length > 0;
    const responseIsJson = isJsonContentType(
      response.headers.get('Content-Type'),
    );
    let responseBody: unknown;
    let validJson = false;
    if (hasBody && responseIsJson) {
      try {
        responseBody = JSON.parse(responseText) as unknown;
        validJson = true;
      } catch {
        // The error below is intentionally independent of the response body.
      }
    }

    if (!response.ok) {
      const envelope = validJson ? parseErrorEnvelope(responseBody) : null;
      throw new ApiError(
        envelope?.message ??
          `Yêu cầu không thành công (HTTP ${response.status}).`,
        {
          code: envelope?.code ?? 'HTTP_ERROR',
          kind: 'http',
          status: response.status,
        },
      );
    }

    if (!hasBody) return undefined as T;
    if (!responseIsJson || !validJson) {
      throw new ApiError('Máy chủ trả về dữ liệu không đúng định dạng JSON.', {
        code: 'INVALID_RESPONSE',
        kind: 'response',
        status: response.status,
      });
    }
    return responseBody as T;
  };
}

export const apiRequest = createApiClient();
