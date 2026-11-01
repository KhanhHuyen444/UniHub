import { protectedApiRequest } from '../auth/auth-api';
import { parseRecommendations } from './contracts';
export async function getRecommendations(signal?: AbortSignal) {
  return parseRecommendations(
    await protectedApiRequest<unknown>('/api/recommendations', {
      signal,
    }),
  );
}
