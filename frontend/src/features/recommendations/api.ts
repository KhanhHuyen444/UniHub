import { ApiError } from '../../lib/api';
import { protectedApiRequest } from '../auth/auth-api';
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
    await protectedApiRequest<unknown>('/api/recommendations', {
      signal,
    }),
  );
}
