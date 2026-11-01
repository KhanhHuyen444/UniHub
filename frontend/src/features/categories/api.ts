import { ApiError } from '../../lib/api';
import { protectedApiRequest } from '../auth/auth-api';
import { getAuthSnapshot } from '../auth/auth-state';
import { parseSkillOptions, type SkillOption } from './contracts';

// Keep the parent token argument for existing Profile consumers. Auth owns the
// actual request token, refresh and retry; never forward a potentially stale prop.
export async function getSkillOptions(
  accessToken: string,
  signal?: AbortSignal,
): Promise<SkillOption[]> {
  signal?.throwIfAborted();
  const auth = getAuthSnapshot();
  if (!accessToken.trim() || auth.status !== 'authenticated')
    throw new ApiError('Cần đăng nhập Student để tải kỹ năng.', {
      code: 'UNAUTHORIZED',
      kind: 'request',
      status: 401,
    });
  if (auth.user?.role !== 'Student')
    throw new ApiError('Danh sách kỹ năng chỉ dành cho Student.', {
      code: 'FORBIDDEN',
      kind: 'request',
      status: 403,
    });
  const value = await protectedApiRequest<unknown>('/api/categories', {
    query: new URLSearchParams({ type: 'Skill' }),
    signal,
  });
  signal?.throwIfAborted();
  return parseSkillOptions(value);
}
