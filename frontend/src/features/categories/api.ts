import { ApiError, apiRequest } from '../../lib/api';
import { parseSkillOptions, type SkillOption } from './contracts';

// Auth owns the token lifecycle. Reuse the shared API client's headers support;
// do not read storage, decode JWTs, refresh or introduce another fetch client.
export async function getSkillOptions(
  accessToken: string,
  signal?: AbortSignal,
): Promise<SkillOption[]> {
  if (!accessToken.trim())
    throw new ApiError('Cần đăng nhập Student để tải kỹ năng.', {
      code: 'UNAUTHORIZED',
      kind: 'request',
      status: 401,
    });
  return parseSkillOptions(
    await apiRequest<unknown>('/api/categories', {
      query: new URLSearchParams({ type: 'Skill' }),
      headers: { Authorization: `Bearer ${accessToken}` },
      signal,
    }),
  );
}
