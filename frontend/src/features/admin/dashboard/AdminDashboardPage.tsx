import { useEffect, useState, type ReactNode } from 'react';
import { Button, Card, ErrorState, LoadingState } from '../../../components/ui';
import { useAuth } from '../../auth/AuthProvider';
import { getAccounts, getOpportunities, getForum } from './api';
import { startMetricRequest, type MetricState } from './metric-request';

export function MetricContent<T extends { evaluatedAt: string }>({
  title,
  state,
  retry,
  children,
}: {
  title: string;
  state: MetricState<T>;
  retry: () => void;
  children: (value: T) => ReactNode;
}) {
  return (
    <Card className="p-6" aria-label={title}>
      <h2 className="mb-4 type-title text-navy">{title}</h2>
      {state.status === 'loading' ? (
        <LoadingState title="Đang tải số liệu…" />
      ) : state.status === 'error' ? (
        <ErrorState
          title="Không tải được số liệu"
          description={state.message}
          onRetry={retry}
        />
      ) : (
        <>
          {children(state.data)}
          <p className="mt-5 text-xs text-muted">
            Cập nhật:{' '}
            <time dateTime={state.data.evaluatedAt}>
              {new Intl.DateTimeFormat('vi-VN', {
                timeZone: 'Asia/Ho_Chi_Minh',
                dateStyle: 'short',
                timeStyle: 'short',
              }).format(new Date(state.data.evaluatedAt))}
            </time>
          </p>
          <Button className="mt-3" variant="text" onClick={retry}>
            Tải lại
          </Button>
        </>
      )}
    </Card>
  );
}
function MetricCard<T extends { evaluatedAt: string }>({
  title,
  load,
  children,
}: {
  title: string;
  load: (signal: AbortSignal) => Promise<T>;
  children: (value: T) => ReactNode;
}) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{
    version: number;
    state: MetricState<T>;
  } | null>(null);
  useEffect(
    () => startMetricRequest(load, (state) => setResult({ version, state })),
    [load, version],
  );
  return (
    <MetricContent
      title={title}
      state={result?.version === version ? result.state : { status: 'loading' }}
      retry={() => setVersion((v) => v + 1)}
    >
      {children}
    </MetricContent>
  );
}
export function AdminDashboardPage() {
  const { status, user } = useAuth();
  if (status !== 'authenticated' || user?.role !== 'Admin') return null;
  return <DashboardContent key={user.id} />;
}
function DashboardContent() {
  return (
    <div>
      <h1 className="type-heading text-navy">Dashboard thống kê</h1>
      <p className="mt-2 type-body text-secondary">
        Số liệu được cập nhật độc lập cho từng mục.
      </p>
      <div className="mt-6 grid items-start gap-6 xl:grid-cols-3">
        <MetricCard title="Tổng tài khoản" load={getAccounts}>
          {(data) => (
            <p className="text-3xl font-semibold text-brand">
              {data.totalAccounts}
            </p>
          )}
        </MetricCard>
        <MetricCard title="Cơ hội" load={getOpportunities}>
          {(data) => (
            <dl className="grid gap-3">
              {(
                [
                  ['Pending', 'Chờ duyệt'],
                  ['Approved', 'Đã duyệt'],
                  ['Rejected', 'Từ chối'],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="flex justify-between gap-4">
                  <dt>{label}</dt>
                  <dd className="font-semibold text-brand">
                    {data.byStatus[key]}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </MetricCard>
        <MetricCard title="Diễn đàn" load={getForum}>
          {(data) => (
            <dl className="grid gap-3">
              <div className="flex justify-between gap-4">
                <dt>Bài viết</dt>
                <dd className="font-semibold text-brand">{data.posts}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Bình luận</dt>
                <dd className="font-semibold text-brand">{data.comments}</dd>
              </div>
            </dl>
          )}
        </MetricCard>
      </div>
    </div>
  );
}
