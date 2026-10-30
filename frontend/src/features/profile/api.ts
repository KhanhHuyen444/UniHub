import { protectedApiRequest } from '../auth/auth-api';
import { parseProfile, type ProfileInput } from './contracts';
export async function getProfile(signal?: AbortSignal) {
  return parseProfile(
    await protectedApiRequest<unknown>('/api/users/me/profile', { signal }),
  );
}
export async function saveProfile(body: ProfileInput, signal?: AbortSignal) {
  return parseProfile(
    await protectedApiRequest<unknown>('/api/users/me/profile', {
      method: 'PUT',
      body,
      signal,
    }),
  );
}
