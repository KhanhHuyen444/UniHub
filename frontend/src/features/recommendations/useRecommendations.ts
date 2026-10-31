import { useEffect, useState } from 'react';
import { getRecommendations } from './api';
import type { RecommendationsResponse } from './contracts';
export type RecommendationsRole = 'Student' | 'Admin' | null;
export type RecommendationsState =
  | { status: 'unauthenticated' | 'forbidden' | 'loading' }
  | { status: 'empty'; evaluatedAt: string }
  | { status: 'success'; data: RecommendationsResponse }
  | { status: 'error'; code: string; httpStatus?: number };
export function useRecommendations(
  accessToken: string | null,
  role: RecommendationsRole,
) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    token: string;
    role: RecommendationsRole;
    attempt: number;
    state: RecommendationsState;
  } | null>(null);
  useEffect(() => {
    if (!accessToken?.trim() || role !== 'Student') return;
    const controller = new AbortController();
    const update = (state: RecommendationsState) => {
      if (!controller.signal.aborted)
        setResult({ token: accessToken, role, attempt, state });
    };
    update({ status: 'loading' });
    getRecommendations(controller.signal).then(
      (data) =>
        update(
          data.items.length
            ? { status: 'success', data }
            : { status: 'empty', evaluatedAt: data.meta.evaluatedAt },
        ),
      (error: unknown) => {
        const detail = error as { code?: unknown; status?: unknown } | null;
        update({
          status: 'error',
          code:
            typeof detail?.code === 'string' ? detail.code : 'UNKNOWN_ERROR',
          httpStatus:
            typeof detail?.status === 'number' ? detail.status : undefined,
        });
      },
    );
    return () => controller.abort();
  }, [accessToken, role, attempt]);
  let state: RecommendationsState;
  if (!accessToken?.trim() || role === null)
    state = { status: 'unauthenticated' };
  else if (role !== 'Student') state = { status: 'forbidden' };
  else if (
    result?.token === accessToken &&
    result.role === role &&
    result.attempt === attempt
  )
    state = result.state;
  else state = { status: 'loading' };
  return { state, retry: () => setAttempt((value) => value + 1) };
}
