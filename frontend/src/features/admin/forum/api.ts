import { apiRequest } from '../../../lib/api';
import {
  parseModerationQueue,
  parseRemoveModerationTarget,
  type ModerationQueueResponse,
  type ModerationTargetType,
  type RemoveModerationTargetResponse,
} from './contracts';

const queuePageSize = 20;

export async function getForumModerationQueue(
  page: number,
  signal: AbortSignal,
): Promise<ModerationQueueResponse> {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(queuePageSize),
  });
  const value = await apiRequest<unknown>('/api/admin/moderation/forum', {
    query,
    signal,
  });
  return parseModerationQueue(value);
}

export async function removeModerationTarget(
  targetType: ModerationTargetType,
  id: number,
  reason: string,
): Promise<RemoveModerationTargetResponse> {
  const path =
    targetType === 'Post'
      ? `/api/admin/moderation/forum/posts/${encodeURIComponent(String(id))}/remove`
      : `/api/admin/moderation/forum/comments/${encodeURIComponent(String(id))}/remove`;
  const value = await apiRequest<unknown>(path, {
    method: 'POST',
    body: { reason },
  });
  return parseRemoveModerationTarget(value, targetType, id);
}
