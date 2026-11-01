import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  getAuthSnapshot,
  subscribeToAuth,
  type AuthSnapshot,
} from '../auth/auth-state';

import { getRecommendations } from './api';
import type { RecommendationsResponse } from './contracts';

function identity(auth: AuthSnapshot): string {
  return auth.status === 'authenticated' && auth.user
    ? `${auth.user.id}:${auth.user.role}`
    : auth.status;
}
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
  const scope = useRef({
    key: identity(getAuthSnapshot()),
    revision: 0,
    controller: null as AbortController | null,
  });
  const subscribe = useCallback(
    (notify: () => void) =>
      subscribeToAuth(() => {
        const key = identity(getAuthSnapshot());
        if (scope.current.key !== key) {
          scope.current.key = key;
          scope.current.revision++;
          scope.current.controller?.abort();
        }
        notify();
      }),
    [],
  );
  const auth = useSyncExternalStore(
    subscribe,
    getAuthSnapshot,
    getAuthSnapshot,
  );
  const owner = identity(auth);
  const revision = scope.current.revision;
  const eligible =
    !!accessToken?.trim() &&
    role === 'Student' &&
    auth.status === 'authenticated' &&
    auth.user?.role === 'Student';
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    owner: string;
    revision: number;
    role: RecommendationsRole;
    attempt: number;
    state: RecommendationsState;
  } | null>(null);
  if (
    result &&
    (!eligible || result.owner !== owner || result.revision !== revision)
  )
    setResult(null);
  useEffect(() => {
    if (!eligible) return;
    const controller = new AbortController();
    scope.current.controller = controller;
    const update = (state: RecommendationsState) => {
      if (
        !controller.signal.aborted &&
        scope.current.revision === revision &&
        identity(getAuthSnapshot()) === owner
      )
        setResult({ owner, revision, role, attempt, state });
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
  }, [eligible, owner, revision, role, attempt]);
  let state: RecommendationsState;
  if (!accessToken?.trim() || role === null || auth.status !== 'authenticated')
    state = { status: 'unauthenticated' };
  else if (role !== 'Student' || auth.user?.role !== 'Student')
    state = { status: 'forbidden' };
  else if (
    result?.owner === owner &&
    result.revision === revision &&
    result.role === role &&
    result.attempt === attempt
  )
    state = result.state;
  else state = { status: 'loading' };
  return { state, retry: () => setAttempt((value) => value + 1) };
}
