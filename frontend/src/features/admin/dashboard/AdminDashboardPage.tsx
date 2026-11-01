import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Button, Card, ErrorState, LoadingState } from '../../../components/ui';
import { useAuth } from '../../auth/AuthProvider';
import { getAccounts, getOpportunities, getForum } from './api';
import { startMetricRequest, type MetricState } from './metric-request';

/* ─── Icons ─── */

function RefreshIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 21h5v-5" />
    </svg>
  );
}

function AlertTriangleIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

/* ─── Utilities ─── */

function formatNumber(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value);
}

function formatTimestamp(isoString?: string): string {
  if (!isoString) return '--:-- - --/--/----';
  const date = new Date(isoString);
  if (!Number.isFinite(date.getTime())) return '--:-- - --/--/----';
  const parts = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('hour')}:${get('minute')} - ${get('day')}/${get('month')}/${get('year')}`;
}

export function calculateDistribution(
  pending: number,
  approved: number,
  rejected: number,
) {
  const total = pending + approved + rejected;
  const approvedPct = total > 0 ? ((approved / total) * 100).toFixed(1) : '0.0';
  const pendingPct = total > 0 ? ((pending / total) * 100).toFixed(1) : '0.0';
  const rejectedPct = total > 0 ? ((rejected / total) * 100).toFixed(1) : '0.0';
  return { total, approvedPct, pendingPct, rejectedPct };
}

/* ─── Backwards-Compatible MetricContent (kept for existing unit tests) ─── */

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
        <div role="alert">
          <ErrorState
            title="Không tải được số liệu"
            description={state.message}
            onRetry={retry}
          />
          <Button className="mt-2" onClick={retry}>
            Thử lại
          </Button>
        </div>
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

/* ─── Hook for individual metric lifecycle ─── */

function useMetric<T>(
  load: (signal: AbortSignal) => Promise<T>,
  globalVersion: number,
) {
  const [localVersion, setLocalVersion] = useState(0);
  const [state, setState] = useState<MetricState<T>>({ status: 'loading' });

  useEffect(() => {
    setState({ status: 'loading' });
    return startMetricRequest(load, setState);
  }, [load, localVersion, globalVersion]);

  const retry = useCallback(() => {
    setLocalVersion((v) => v + 1);
  }, []);

  return { state, retry };
}

/* ─── KPI Card ─── */

function KpiCard({
  title,
  dotColor,
  value,
  loading,
  error,
  onRetry,
  ariaLabel,
}: {
  title: string;
  dotColor?: string;
  value?: number;
  loading: boolean;
  error?: string;
  onRetry?: () => void;
  ariaLabel?: string;
}) {
  return (
    <Card
      className="flex min-h-[118px] flex-col justify-between rounded-xl border border-line bg-white p-5 shadow-soft transition-all"
      aria-label={ariaLabel}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-secondary">{title}</span>
        {dotColor && (
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: dotColor }}
            aria-hidden="true"
          />
        )}
      </div>
      <div className="mt-3">
        {loading ? (
          <div className="h-9 w-24 animate-pulse rounded bg-slate-100" />
        ) : error ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-danger">
              Lỗi tải dữ liệu
            </span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="text-xs font-semibold text-brand underline hover:opacity-80"
              >
                Thử lại
              </button>
            )}
          </div>
        ) : (
          <span className="text-3xl font-bold tracking-tight text-navy">
            {value !== undefined ? formatNumber(value) : '0'}
          </span>
        )}
      </div>
    </Card>
  );
}

/* ─── SVG Donut Chart ─── */

export function DonutChart({
  pending,
  approved,
  rejected,
  total,
}: {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}) {
  const size = 180;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const safeTotal = total > 0 ? total : 0;
  const approvedLen =
    safeTotal > 0 ? (approved / safeTotal) * circumference : 0;
  const pendingLen = safeTotal > 0 ? (pending / safeTotal) * circumference : 0;
  const rejectedLen =
    safeTotal > 0 ? (rejected / safeTotal) * circumference : 0;

  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="rotate-[-90deg] overflow-visible"
        aria-hidden="true"
      >
        {safeTotal === 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#E2E8F0"
            strokeWidth={strokeWidth}
          />
        ) : (
          <>
            {approvedLen > 0 && (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke="#15803D"
                strokeWidth={strokeWidth}
                strokeDasharray={`${approvedLen} ${circumference}`}
                strokeDashoffset={0}
              />
            )}
            {pendingLen > 0 && (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke="#B45309"
                strokeWidth={strokeWidth}
                strokeDasharray={`${pendingLen} ${circumference}`}
                strokeDashoffset={-approvedLen}
              />
            )}
            {rejectedLen > 0 && (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke="#DC2626"
                strokeWidth={strokeWidth}
                strokeDasharray={`${rejectedLen} ${circumference}`}
                strokeDashoffset={-(approvedLen + pendingLen)}
              />
            )}
          </>
        )}
      </svg>
      <div className="pointer-events-none absolute flex flex-col items-center justify-center text-center">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Tổng cộng
        </span>
        <span className="text-2xl font-bold leading-tight text-navy">
          {formatNumber(safeTotal)}
        </span>
        <span className="text-xs text-muted">cơ hội</span>
      </div>
    </div>
  );
}

/* ─── Main AdminDashboardPage Component ─── */

export function AdminDashboardPage() {
  const { status, user } = useAuth();
  if (status !== 'authenticated' || user?.role !== 'Admin') return null;
  return <DashboardContent key={user.id} />;
}

function DashboardContent() {
  const [globalVersion, setGlobalVersion] = useState(0);

  const { state: accountsState, retry: retryAccounts } = useMetric(
    getAccounts,
    globalVersion,
  );
  const { state: oppsState, retry: retryOpps } = useMetric(
    getOpportunities,
    globalVersion,
  );
  const { state: forumState, retry: retryForum } = useMetric(
    getForum,
    globalVersion,
  );

  const handleRefreshAll = () => {
    setGlobalVersion((v) => v + 1);
  };

  // Sync state & latest evaluated timestamp
  const states = [accountsState.status, oppsState.status, forumState.status];
  const isAnyLoading = states.some((s) => s === 'loading');
  const hasAnySuccess = states.some((s) => s === 'success');
  const hasAnyError = states.some((s) => s === 'error');
  const isAllSuccess = states.every((s) => s === 'success');

  // Find latest evaluatedAt among successful metrics
  const evaluatedDates = [
    accountsState.status === 'success' ? accountsState.data.evaluatedAt : null,
    oppsState.status === 'success' ? oppsState.data.evaluatedAt : null,
    forumState.status === 'success' ? forumState.data.evaluatedAt : null,
  ].filter((d): d is string => Boolean(d));

  const latestEvaluatedAt =
    evaluatedDates.length > 0
      ? evaluatedDates.reduce((latest, current) =>
          new Date(current) > new Date(latest) ? current : latest,
        )
      : undefined;

  // Opportunity totals & breakdown calculations
  const pending =
    oppsState.status === 'success' ? oppsState.data.byStatus.Pending : 0;
  const approved =
    oppsState.status === 'success' ? oppsState.data.byStatus.Approved : 0;
  const rejected =
    oppsState.status === 'success' ? oppsState.data.byStatus.Rejected : 0;
  const totalOpportunities = pending + approved + rejected;

  const approvedPct =
    totalOpportunities > 0
      ? ((approved / totalOpportunities) * 100).toFixed(1)
      : '0.0';
  const pendingPct =
    totalOpportunities > 0
      ? ((pending / totalOpportunities) * 100).toFixed(1)
      : '0.0';
  const rejectedPct =
    totalOpportunities > 0
      ? ((rejected / totalOpportunities) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="pb-8">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy sm:text-[28px]">
            Dashboard thống kê
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">
              Cập nhật lúc {formatTimestamp(latestEvaluatedAt)}
            </span>
            <span className="text-slate-300" aria-hidden="true">
              •
            </span>
            {isAllSuccess ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Đồng bộ hoàn tất
              </span>
            ) : hasAnySuccess && hasAnyError ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-amber-600">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Đồng bộ dữ liệu một phần
              </span>
            ) : hasAnyError && !hasAnySuccess ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-danger">
                <span className="h-2 w-2 rounded-full bg-danger" />
                Lỗi đồng bộ dữ liệu
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-medium text-brand">
                <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
                Đang đồng bộ dữ liệu…
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleRefreshAll}
          disabled={isAnyLoading}
          className="inline-flex h-10 items-center gap-2 rounded-control border border-line bg-white px-4 py-2 text-sm font-medium text-brand shadow-soft transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
        >
          <RefreshIcon
            className={`h-4 w-4 ${isAnyLoading ? 'animate-spin' : ''}`}
          />
          Làm mới
        </button>
      </div>

      {/* ── 4 KPI Cards Row ── */}
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Tổng tài khoản đăng ký"
          value={
            accountsState.status === 'success'
              ? accountsState.data.totalAccounts
              : undefined
          }
          loading={accountsState.status === 'loading'}
          error={
            accountsState.status === 'error' ? accountsState.message : undefined
          }
          onRetry={retryAccounts}
          ariaLabel="Tổng tài khoản"
        />

        <KpiCard
          title="Chờ thẩm định (Pending)"
          dotColor="#B45309"
          value={oppsState.status === 'success' ? pending : undefined}
          loading={oppsState.status === 'loading'}
          error={oppsState.status === 'error' ? oppsState.message : undefined}
          onRetry={retryOpps}
        />

        <KpiCard
          title="Đã duyệt (Approved)"
          dotColor="#15803D"
          value={oppsState.status === 'success' ? approved : undefined}
          loading={oppsState.status === 'loading'}
          error={oppsState.status === 'error' ? oppsState.message : undefined}
          onRetry={retryOpps}
        />

        <KpiCard
          title="Từ chối (Rejected)"
          dotColor="#DC2626"
          value={oppsState.status === 'success' ? rejected : undefined}
          loading={oppsState.status === 'loading'}
          error={oppsState.status === 'error' ? oppsState.message : undefined}
          onRetry={retryOpps}
        />
      </div>

      {/* ── Bottom 2 Panels: Donut Chart & Discussion Interaction ── */}
      <div className="mt-6 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
        {/* Left Panel: Phân bổ cơ hội theo trạng thái */}
        <Card
          className="flex flex-col justify-between rounded-xl border border-line bg-white p-6 shadow-soft lg:col-span-7 xl:col-span-8"
          aria-label="Cơ hội"
        >
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-4">
              <h2 className="text-lg font-bold text-navy">
                Phân bổ cơ hội theo trạng thái
              </h2>
              {oppsState.status === 'success' && (
                <span className="text-sm text-secondary">
                  Tổng số cơ hội:{' '}
                  <strong className="font-bold text-navy">
                    {formatNumber(totalOpportunities)}
                  </strong>
                </span>
              )}
            </div>

            <div className="pt-6">
              {oppsState.status === 'loading' ? (
                <div className="py-12">
                  <LoadingState title="Đang tải dữ liệu cơ hội…" />
                </div>
              ) : oppsState.status === 'error' ? (
                <div className="py-8" role="alert">
                  <ErrorState
                    title="Không tải được dữ liệu cơ hội"
                    description={oppsState.message}
                    onRetry={retryOpps}
                  />
                  <div className="mt-4 text-center">
                    <Button onClick={retryOpps}>Thử lại</Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-12">
                  {/* Donut Chart */}
                  <div className="flex justify-center md:col-span-5">
                    <DonutChart
                      pending={pending}
                      approved={approved}
                      rejected={rejected}
                      total={totalOpportunities}
                    />
                  </div>

                  {/* Breakdown List & Progress Bar */}
                  <div className="flex flex-col gap-3 md:col-span-7">
                    <div className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-3.5 w-3.5 rounded-sm bg-[#15803D]"
                          aria-hidden="true"
                        />
                        <span className="text-sm font-medium text-navy">
                          Đã duyệt (Approved)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#15803D]">
                          {formatNumber(approved)}
                        </span>
                        <span className="text-xs text-muted">
                          ({approvedPct}%)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50/80 px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-3.5 w-3.5 rounded-sm bg-[#B45309]"
                          aria-hidden="true"
                        />
                        <span className="text-sm font-medium text-navy">
                          Chờ thẩm định (Pending)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#B45309]">
                          {formatNumber(pending)}
                        </span>
                        <span className="text-xs text-muted">
                          ({pendingPct}%)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-3.5 w-3.5 rounded-sm bg-[#DC2626]"
                          aria-hidden="true"
                        />
                        <span className="text-sm font-medium text-navy">
                          Từ chối (Rejected)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#DC2626]">
                          {formatNumber(rejected)}
                        </span>
                        <span className="text-xs text-muted">
                          ({rejectedPct}%)
                        </span>
                      </div>
                    </div>

                    {/* Horizontal Stacked Progress Bar */}
                    <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      {Number(approvedPct) > 0 && (
                        <div
                          className="h-full bg-[#15803D] transition-all"
                          style={{ width: `${approvedPct}%` }}
                          title={`Đã duyệt: ${approvedPct}%`}
                        />
                      )}
                      {Number(pendingPct) > 0 && (
                        <div
                          className="h-full bg-[#B45309] transition-all"
                          style={{ width: `${pendingPct}%` }}
                          title={`Chờ thẩm định: ${pendingPct}%`}
                        />
                      )}
                      {Number(rejectedPct) > 0 && (
                        <div
                          className="h-full bg-[#DC2626] transition-all"
                          style={{ width: `${rejectedPct}%` }}
                          title={`Từ chối: ${rejectedPct}%`}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Right Panel: Tương tác thảo luận */}
        <Card
          className={`flex flex-col justify-between rounded-xl border bg-white p-6 shadow-soft lg:col-span-5 xl:col-span-4 ${
            forumState.status === 'error' ? 'border-red-200' : 'border-line'
          }`}
          aria-label="Diễn đàn"
        >
          <div>
            <div className="flex items-center justify-between border-b border-line pb-4">
              <h2 className="text-lg font-bold text-navy">
                Tương tác thảo luận
              </h2>
              <button
                type="button"
                onClick={retryForum}
                disabled={forumState.status === 'loading'}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-secondary transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-60"
                title="Tải lại thảo luận"
                aria-label="Tải lại thảo luận"
              >
                <RefreshIcon
                  className={`h-4 w-4 ${
                    forumState.status === 'loading'
                      ? 'animate-spin text-brand'
                      : forumState.status === 'error'
                        ? 'text-danger'
                        : 'text-secondary'
                  }`}
                />
              </button>
            </div>

            <div className="pt-6">
              {forumState.status === 'loading' ? (
                <div className="py-12">
                  <LoadingState title="Đang tải dữ liệu thảo luận…" />
                </div>
              ) : forumState.status === 'error' ? (
                <div
                  className="my-4 flex flex-col items-center text-center"
                  role="alert"
                >
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-danger">
                    <AlertTriangleIcon className="h-7 w-7" />
                  </div>
                  <h3 className="text-base font-bold text-danger">
                    Lỗi tải dữ liệu
                  </h3>
                  <p className="mt-1.5 max-w-[260px] text-sm text-secondary">
                    Không thể tải dữ liệu thống kê, vui lòng thử lại
                  </p>
                  <button
                    type="button"
                    onClick={retryForum}
                    className="mt-5 inline-flex items-center gap-2 rounded-control bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-soft transition-colors hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    <RefreshIcon className="h-4 w-4" />
                    Tải lại
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 py-4">
                  <div className="flex flex-col items-center justify-center rounded-lg bg-slate-50 p-5 text-center">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Bài viết
                    </span>
                    <span className="mt-2 text-3xl font-bold tracking-tight text-navy">
                      {formatNumber(forumState.data.posts)}
                    </span>
                  </div>

                  <div className="flex flex-col items-center justify-center rounded-lg bg-slate-50 p-5 text-center">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Bình luận
                    </span>
                    <span className="mt-2 text-3xl font-bold tracking-tight text-navy">
                      {formatNumber(forumState.data.comments)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-muted">
            {forumState.status === 'error'
              ? 'Các dữ liệu khác vẫn cập nhật bình thường'
              : forumState.status === 'success'
                ? `Cập nhật: ${formatTimestamp(forumState.data.evaluatedAt)}`
                : 'Đang kết nối tới máy chủ…'}
          </p>
        </Card>
      </div>
    </div>
  );
}
