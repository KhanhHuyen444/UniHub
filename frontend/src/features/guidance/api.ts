import { apiRequest, ApiError } from '../../lib/api';
import { protectedApiRequest } from '../auth/auth-api';
import { getAuthSnapshot } from '../auth/auth-state';
import {
  isGuidanceId,
  parseGuidanceList,
  parseGuidanceDetail,
  type GuidanceListResponse,
  type GuidanceDetailResponse,
} from './contracts';

export interface GuidanceListOptions {
  majorId?: number;
  signal?: AbortSignal;
}

export async function getGuidanceList({
  majorId,
  signal,
}: GuidanceListOptions = {}): Promise<GuidanceListResponse> {
  if (majorId !== undefined && !isGuidanceId(majorId)) {
    throw new ApiError('Mã chuyên ngành không hợp lệ.', {
      code: 'INVALID_QUERY',
      kind: 'request',
    });
  }
  const query = new URLSearchParams();
  if (majorId !== undefined) query.set('majorId', String(majorId));

  const auth = getAuthSnapshot();
  const value =
    auth.status === 'authenticated' && auth.user?.role === 'Student'
      ? await protectedApiRequest<unknown>('/api/guidance', { query, signal })
      : await apiRequest<unknown>('/api/guidance', { query, signal });

  signal?.throwIfAborted();
  return parseGuidanceList(value);
}

export async function getGuidanceDetail(
  id: number,
  signal?: AbortSignal,
): Promise<GuidanceDetailResponse> {
  if (!isGuidanceId(id)) {
    throw new ApiError('Mã bài định hướng không hợp lệ.', {
      code: 'INVALID_ID',
      kind: 'request',
    });
  }
  const value = await apiRequest<unknown>(`/api/guidance/${id}`, { signal });
  signal?.throwIfAborted();
  return parseGuidanceDetail(value);
}
