import { protectedApiRequest } from '../auth/auth-api';
import { parseEvent, parseEvents, type EventInput } from './model';
async function eventRequest(
  path: string,
  options: Parameters<typeof protectedApiRequest>[1],
) {
  const value = await protectedApiRequest<{ event?: unknown }>(path, options);
  return parseEvent(value?.event);
}
export async function listEvents(
  from: string,
  to: string,
  signal?: AbortSignal,
) {
  return parseEvents(
    await protectedApiRequest<unknown>('/api/events', {
      query: new URLSearchParams({ from, to }),
      signal,
    }),
  );
}
export const createEvent = (body: EventInput, signal?: AbortSignal) =>
  eventRequest('/api/events', { method: 'POST', body, signal });
export const getEvent = (id: number, signal?: AbortSignal) =>
  eventRequest(`/api/events/${id}`, { signal });
export const editEvent = (
  id: number,
  body: Partial<EventInput>,
  signal?: AbortSignal,
) => eventRequest(`/api/events/${id}`, { method: 'PATCH', body, signal });
export const completeEvent = (id: number, signal?: AbortSignal) =>
  eventRequest(`/api/events/${id}/status`, {
    method: 'PATCH',
    body: { status: 'Completed' },
    signal,
  });
export const deleteEvent = (id: number, signal?: AbortSignal) =>
  protectedApiRequest<void>(`/api/events/${id}`, { method: 'DELETE', signal });
