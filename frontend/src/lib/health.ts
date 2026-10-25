import { ApiError, apiRequest } from './api';

export async function checkBackend(signal: AbortSignal): Promise<void> {
  const body = await apiRequest<unknown>('/api/health', {
    signal,
    cache: 'no-store',
  });
  if (
    !body ||
    typeof body !== 'object' ||
    !('status' in body) ||
    body.status !== 'ok' ||
    !('service' in body) ||
    body.service !== 'unihub-api'
  ) {
    throw new ApiError('Phản hồi health không đúng định dạng.', {
      code: 'INVALID_RESPONSE',
      kind: 'response',
    });
  }
}
