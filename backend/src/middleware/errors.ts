import type { ErrorRequestHandler, RequestHandler } from 'express';

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
