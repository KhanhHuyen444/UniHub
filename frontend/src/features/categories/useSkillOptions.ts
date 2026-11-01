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

import { getSkillOptions } from './api';
import type { SkillOption } from './contracts';

function identity(auth: AuthSnapshot): string {
  return auth.status === 'authenticated' && auth.user
    ? `${auth.user.id}:${auth.user.role}`
    : auth.status;
}
export type SkillOptionsRole = 'Student' | 'Admin' | null;
export type SkillOptionsState =
  | { status: 'unauthenticated' | 'forbidden' | 'loading' }
  | { status: 'success'; options: SkillOption[] }
  | { status: 'error'; code: string; httpStatus?: number };
export function useSkillOptions(
  accessToken: string | null,
  role: SkillOptionsRole,
) {
  // Track every identity transition, including batched logout/login of one user.
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
    role: SkillOptionsRole;
    attempt: number;
    state: SkillOptionsState;
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
    const update = (state: SkillOptionsState) => {
      if (
        !controller.signal.aborted &&
        scope.current.revision === revision &&
        identity(getAuthSnapshot()) === owner
      )
        setResult({ owner, revision, role, attempt, state });
    };
    update({ status: 'loading' });
    getSkillOptions(accessToken!, controller.signal).then(
      (options) => update({ status: 'success', options }),
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
    // Token text is intentionally excluded: shared refresh owns its single retry.
  }, [eligible, owner, revision, role, attempt]);
  let state: SkillOptionsState;
  if (auth.status === 'unavailable')
    state = { status: 'error', code: 'SERVICE_UNAVAILABLE', httpStatus: 503 };
  else if (auth.status === 'restoring') state = { status: 'loading' };
  else if (
    !accessToken?.trim() ||
    role === null ||
    auth.status !== 'authenticated'
  )
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
