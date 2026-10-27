import type { ErrorRequestHandler, RequestHandler } from 'express';
import {
  DatabaseNotConfiguredError,
  InvalidDatabaseConfigurationError,
} from '../lib/prisma.js';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function isDatabaseUnavailable(error: unknown): boolean {
  if (
    error instanceof DatabaseNotConfiguredError ||
    error instanceof InvalidDatabaseConfigurationError
  ) {
    return true;
  }

  const pending = [error];
  const seen = new Set<unknown>();
  const unavailableCodes = new Set([
    'P1000',
    'P1001',
    'P1002',
    'P1003',
    'P1008',
    'P1010',
    'P1011',
    'P1017',
    'P2024',
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'EPIPE',
    'PROTOCOL_CONNECTION_LOST',
    'ER_ACCESS_DENIED_ERROR',
    'ER_CON_COUNT_ERROR',
    'ER_BAD_DB_ERROR',
    'ER_TABLEACCESS_DENIED_ERROR',
  ]);

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);

    const candidate = current as {
      code?: unknown;
      errorCode?: unknown;
      cause?: unknown;
    };
    if (
      (typeof candidate.code === 'string' &&
        unavailableCodes.has(candidate.code)) ||
      (typeof candidate.errorCode === 'string' &&
        unavailableCodes.has(candidate.errorCode))
    ) {
      return true;
    }
    pending.push(candidate.cause);
  }

  return false;
}

export function asPublicApiError(error: unknown): unknown {
  if (error instanceof ApiError) return error;
  if (isDatabaseUnavailable(error)) {
    return new ApiError(
      503,
      'SERVICE_UNAVAILABLE',
      'Database hiện không sẵn sàng.',
    );
  }
  return error;
}

export const notFound: RequestHandler = (_request, response) => {
  response.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Không tìm thấy tài nguyên.' },
  });
};

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  next,
) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ApiError) {
    response.status(error.status).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }

  const type =
    error && typeof error === 'object' && 'type' in error
      ? error.type
      : undefined;

  if (type === 'entity.parse.failed') {
    response.status(400).json({
      error: { code: 'INVALID_JSON', message: 'Nội dung JSON không hợp lệ.' },
    });
    return;
  }
  if (type === 'entity.too.large') {
    response.status(413).json({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Nội dung yêu cầu vượt quá 100 KB.',
      },
    });
    return;
  }
  if (type === 'encoding.unsupported' || type === 'charset.unsupported') {
    response.status(415).json({
      error: {
        code: 'UNSUPPORTED_ENCODING',
        message: 'Mã hóa nội dung không được hỗ trợ.',
      },
    });
    return;
  }

  console.error('Đã xảy ra lỗi nội bộ khi xử lý HTTP request.');
  response.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Máy chủ gặp lỗi nội bộ.' },
  });
};
