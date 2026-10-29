import { ApiError, apiRequest } from '../../lib/api';
import { parseRecommendations } from './contracts';
export async function getRecommendations(
  accessToken: string,
  signal?: AbortSignal,
) {
  if (!accessToken.trim())
    throw new ApiError('Cần đăng nhập Student.', {
      code: 'UNAUTHORIZED',
      kind: 'request',
      status: 401,
    });
  return parseRecommendations(
    await apiRequest<unknown>('/api/recommendations', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal,
    }),
  );
}
