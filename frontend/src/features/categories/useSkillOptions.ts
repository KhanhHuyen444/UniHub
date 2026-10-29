import { useEffect, useState } from 'react';
import { getSkillOptions } from './api';
import type { SkillOption } from './contracts';

export type SkillOptionsRole = 'Student' | 'Admin' | null;
export type SkillOptionsState =
  | { status: 'unauthenticated' | 'forbidden' | 'loading' }
  | { status: 'success'; options: SkillOption[] }
  | { status: 'error'; code: string; httpStatus?: number };

export function useSkillOptions(
  accessToken: string | null,
  role: SkillOptionsRole,
) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    token: string | null;
    role: SkillOptionsRole;
    attempt: number;
    state: SkillOptionsState;
  } | null>(null);
  const canLoad = Boolean(accessToken?.trim()) && role === 'Student';
  useEffect(() => {
    if (!canLoad || !accessToken) return;
    const controller = new AbortController();
    let active = true;
    const update = (state: SkillOptionsState) => {
      if (active && !controller.signal.aborted)
        setResult({ token: accessToken, role, attempt, state });
    };
    update({ status: 'loading' });
    getSkillOptions(accessToken, controller.signal).then(
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
    return () => {
      active = false;
      controller.abort();
    };
  }, [accessToken, role, attempt, canLoad]);
  let state: SkillOptionsState;
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
