import { getAuthSnapshot, subscribeToAuth } from '../../auth/auth-state';

export type MetricState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string };

// One lifecycle per card/retry. The abort check also rejects late results from transports ignoring cancellation.
export function startMetricRequest<T>(
  load: (signal: AbortSignal) => Promise<T>,
  update: (state: MetricState<T>) => void,
): () => void {
  const controller = new AbortController();
  const identity = getAuthSnapshot();
  const unsubscribe = subscribeToAuth(() => {
    const current = getAuthSnapshot();
    if (
      current.status !== identity.status ||
      current.user?.id !== identity.user?.id ||
      current.user?.role !== identity.user?.role
    )
      controller.abort();
  });
  if (identity.status === 'authenticated' && identity.user?.role === 'Admin') {
    update({ status: 'loading' });
    void load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) update({ status: 'success', data });
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          update({
            status: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Không tải được số liệu.',
          });
      },
    );
  }
  return () => {
    controller.abort();
    unsubscribe();
  };
}
