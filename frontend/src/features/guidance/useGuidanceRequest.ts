import { useEffect, useState } from 'react';

type RequestState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; code: string; httpStatus?: number };

export function useGuidanceRequest<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    attempt: number;
    state: RequestState<T>;
  }>({ key, attempt, state: { status: 'loading' } });
  useEffect(() => {
    const controller = new AbortController();
    setResult({ key, attempt, state: { status: 'loading' } });
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted)
          setResult({ key, attempt, state: { status: 'success', data } });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        const detail = error as { code?: unknown; status?: unknown } | null;
        setResult({
          key,
          attempt,
          state: {
            status: 'error',
            code:
              typeof detail?.code === 'string' ? detail.code : 'UNKNOWN_ERROR',
            httpStatus:
              typeof detail?.status === 'number' ? detail.status : undefined,
          },
        });
      },
    );
    return () => controller.abort();
  }, [key, attempt, load]);
  const state: RequestState<T> =
    result.key === key && result.attempt === attempt
      ? result.state
      : { status: 'loading' };
  return { state, retry: () => setAttempt((value) => value + 1) };
}
