import { useEffect, useState } from 'react';
import { getAdminCategories } from './api';
import type { AdminCategory, CategoryType } from './contracts';

export interface CategoryError {
  code: string;
  httpStatus?: number;
}
export function categoryError(error: unknown): CategoryError {
  const detail = error as { code?: unknown; status?: unknown } | null;
  return {
    code: typeof detail?.code === 'string' ? detail.code : 'UNKNOWN_ERROR',
    httpStatus: typeof detail?.status === 'number' ? detail.status : undefined,
  };
}
type LoadState =
  | { status: 'loading' }
  | { status: 'success'; items: AdminCategory[] }
  | { status: 'error'; error: CategoryError };
export function useAdminCategories(token: string, type: CategoryType) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{
    token: string;
    type: CategoryType;
    version: number;
    state: LoadState;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const update = (state: LoadState) => {
      if (!controller.signal.aborted)
        setResult({ token, type, version, state });
    };
    update({ status: 'loading' });
    getAdminCategories(token, type, controller.signal).then(
      (items) => update({ status: 'success', items }),
      (error: unknown) =>
        update({ status: 'error', error: categoryError(error) }),
    );
    return () => controller.abort();
  }, [token, type, version]);
  const state: LoadState =
    result?.token === token &&
    result.type === type &&
    result.version === version
      ? result.state
      : { status: 'loading' };
  return { state, reload: () => setVersion((value) => value + 1) };
}
