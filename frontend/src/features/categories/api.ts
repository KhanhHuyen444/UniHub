import { ApiError } from '../../lib/api';
import { protectedApiRequest } from '../auth/auth-api';
import { parseSkillOptions, type SkillOption } from './contracts';

// Auth owns the token lifecycle, including refresh and retry.
// The token argument remains a caller gate; the shared client reads the current session.
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
    await protectedApiRequest<unknown>('/api/categories', {
      query: new URLSearchParams({ type: 'Skill' }),
      signal,
    }),
  );
}
