import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import { ApiError } from '../../../lib/api';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormField,
  LoadingState,
} from '../../../components/ui';
import { formatOpportunityDate } from '../../opportunities/contracts';
import {
  approveAdminOpportunity,
  getAdminOpportunity,
  getPendingOpportunities,
  rejectAdminOpportunity,
} from './api';
import type {
  AdminOpportunity,
  PendingOpportunitiesResponse,
} from './contracts';

type QueueState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'success'; data: PendingOpportunitiesResponse };

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'success'; data: AdminOpportunity }
  | { status: 'invalid-id' };

type ReviewChoice = { verified: boolean } | null;

function errorCode(error: unknown): string {
  return error instanceof ApiError ? error.code : 'UNKNOWN_ERROR';
}

function errorStatus(error: unknown): number | undefined {
  return error instanceof ApiError ? error.status : undefined;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return 'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.';
    if (error.status === 403)
      return 'Tài khoản hiện tại không có quyền duyệt cơ hội.';
    if (error.status === 503)
      return 'Dịch vụ hoặc cơ sở dữ liệu đang tạm thời không sẵn sàng.';
    return error.message;
  }
  return 'Không thể kết nối hoặc dữ liệu máy chủ không hợp lệ.';
}

function isValidId(value: string): boolean {
  if (!/^[1-9]\d*$/.test(value)) return false;
  return Number.isSafeInteger(Number(value));
}

function currentPage(value: string | null): number {
  if (!value || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 && page <= 1_000_000 ? page : 1;
}

function formatCreatedAt(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
}

function deadlineLabel(item: AdminOpportunity): string {
  if (!item.deadline) return 'Không có hạn';
  if (item.deadline.precision === 'unknown') return 'Chưa xác định hạn';
  return formatOpportunityDate(item.deadline.date);
}

function statusLabel(status: AdminOpportunity['status']): string {
  if (status === 'Approved') return 'Đã duyệt';
  if (status === 'Rejected') return 'Đã từ chối';
  return 'Chờ thẩm định';
}

function queueErrorTitle(error: unknown): string {
  const status = errorStatus(error);
  if (status === 401) return 'Phiên quản trị đã hết hạn';
  if (status === 403) return 'Tài khoản không có quyền quản trị';
  return 'Chưa thể tải hàng chờ';
}

function ReviewQueue({
  state,
  selectedId,
  page,
  onPageChange,
  onRetry,
}: {
  state: QueueState;
  selectedId: string | undefined;
  page: number;
  onPageChange: (next: number) => void;
  onRetry: () => void;
}) {
  return (
    <section aria-labelledby="queue-heading" className="min-w-0">
      <div className="mb-4">
        <h2 id="queue-heading" className="type-title text-navy">
          Hàng đợi chờ thẩm định
        </h2>
        {state.status === 'success' && (
          <p className="mt-1 type-caption text-secondary">
            Hiển thị {state.data.items.length} / {state.data.meta.total} tin
          </p>
        )}
      </div>

      {state.status === 'loading' && (
        <LoadingState title="Đang tải cơ hội chờ duyệt" />
      )}
      {state.status === 'error' && (
        <ErrorState
          title={queueErrorTitle(state.error)}
          description={errorMessage(state.error)}
          onRetry={onRetry}
        />
      )}
      {state.status === 'success' && state.data.items.length === 0 && (
        <EmptyState
          title="Không có cơ hội chờ duyệt"
          description="Hàng chờ hiện không có cơ hội ở trạng thái Pending."
        />
      )}
      {state.status === 'success' && state.data.items.length > 0 && (
        <>
          <ul className="grid gap-3">
            {state.data.items.map((item) => {
              const selected = selectedId === String(item.id);
              return (
                <li key={item.id}>
                  <Link
                    to={`/admin/opportunities/${item.id}${window.location.search}`}
                    aria-current={selected ? 'page' : undefined}
                    className={`block rounded-card border bg-white p-4 shadow-soft transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${selected ? 'border-2 border-brand' : 'border-line hover:border-brand/50'}`}
                  >
                    <p className="type-caption font-semibold uppercase text-secondary">
                      {item.type}
                    </p>
                    <h3 className="mt-1 line-clamp-2 type-title text-ink">
                      {item.title}
                    </h3>
                    <p className="mt-1 line-clamp-1 type-label text-secondary">
                      {item.publisher}
                    </p>
                    <div className="mt-3 border-t border-line pt-2 type-caption text-secondary">
                      <p>Hạn nộp: {deadlineLabel(item)}</p>
                      <p className="mt-1">
                        {item.workFormat ?? 'Chưa có hình thức'}
                        {item.location ? ` · ${item.location}` : ''}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          {state.data.meta.totalPages > 1 && (
            <nav
              aria-label="Phân trang hàng chờ"
              className="mt-5 flex flex-wrap items-center justify-center gap-2"
            >
              <Button
                size="compact"
                variant="outline"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                Trước
              </Button>
              <span
                className="px-2 type-caption text-secondary"
                aria-live="polite"
              >
                Trang {page} / {state.data.meta.totalPages}
              </span>
              <Button
                size="compact"
                variant="outline"
                disabled={page >= state.data.meta.totalPages}
                onClick={() => onPageChange(page + 1)}
              >
                Tiếp
              </Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

function ContentBlock({
  title,
  content,
}: {
  title: string;
  content: string | null;
}) {
  if (!content?.trim()) return null;
  return (
    <section>
      <h3 className="type-title text-navy">{title}</h3>
      <p className="mt-2 whitespace-pre-line break-words type-body text-secondary">
        {content}
      </p>
    </section>
  );
}

function ReviewDialog({
  choice,
  onCancel,
  onConfirm,
  busy,
}: {
  choice: ReviewChoice;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  if (choice === null) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="approve-title"
        className="w-full max-w-lg rounded-card border border-line bg-white p-6 shadow-card"
      >
        <h2 id="approve-title" className="type-title text-navy">
          Xác nhận duyệt cơ hội
        </h2>
        <p className="mt-3 type-body text-secondary">
          {choice.verified
            ? 'Cơ hội sẽ được duyệt và cấp nhãn Verified.'
            : 'Cơ hội sẽ được duyệt nhưng không cấp nhãn Verified.'}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" disabled={busy} onClick={onCancel}>
            Hủy
          </Button>
          <Button loading={busy} onClick={onConfirm}>
            Xác nhận duyệt
          </Button>
        </div>
      </section>
    </div>
  );
}

function AdminOpportunityDetail({
  detail,
  onRetry,
  onApprove,
  onReject,
  busy,
  notice,
  error,
  validationError,
  onClearNotice,
  onClearErrors,
}: {
  detail: DetailState;
  onRetry: () => void;
  onApprove: (verified: boolean) => void;
  onReject: (reason: string) => Promise<boolean>;
  busy: boolean;
  notice: string | null;
  error: string | null;
  validationError: string | null;
  onClearNotice: () => void;
  onClearErrors: () => void;
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  if (detail.status === 'loading')
    return <LoadingState title="Đang tải chi tiết cơ hội" />;
  if (detail.status === 'invalid-id') {
    return (
      <EmptyState
        title="ID cơ hội không hợp lệ"
        description="ID phải là số nguyên dương."
      />
    );
  }
  if (detail.status === 'error') {
    const status = errorStatus(detail.error);
    if (status === 404) {
      return (
        <EmptyState
          title="Không tìm thấy cơ hội"
          description="Cơ hội không tồn tại hoặc không còn trong hệ thống."
        />
      );
    }
    return (
      <ErrorState
        title={
          status === 401
            ? 'Phiên quản trị đã hết hạn'
            : status === 403
              ? 'Không có quyền xem cơ hội'
              : 'Chưa thể tải chi tiết'
        }
        description={errorMessage(detail.error)}
        onRetry={onRetry}
      />
    );
  }

  const item = detail.data;
  const reviewable = item.status === 'Pending';
  return (
    <article aria-labelledby="opportunity-title" className="min-w-0">
      {notice && (
        <div
          role="status"
          className="mb-4 flex items-start justify-between gap-4 rounded-control border border-info/20 bg-info-surface p-3 type-label text-info"
        >
          <span>{notice}</span>
          <button
            type="button"
            aria-label="Đóng thông báo"
            className="rounded-sm px-1 font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            onClick={onClearNotice}
          >
            ×
          </button>
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-control border border-danger-line bg-danger-surface p-3 type-label text-danger"
        >
          {error}{' '}
          <button
            type="button"
            onClick={onRetry}
            className="font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Tải lại dữ liệu
          </button>
        </p>
      )}
      <Card className="p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={
              item.status === 'Pending'
                ? 'warning'
                : item.status === 'Approved'
                  ? 'success'
                  : 'error'
            }
          >
            {statusLabel(item.status)}
          </Badge>
          {item.isVerified && <Badge variant="success">Verified</Badge>}
        </div>
        <h2
          id="opportunity-title"
          className="mt-4 break-words text-2xl font-semibold leading-8 text-navy"
        >
          {item.title}
        </h2>
        <p className="mt-2 type-label text-secondary">{item.publisher}</p>
        {item.sourceUrl && (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex break-all type-label font-medium text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Xem nguồn tin gốc{' '}
            <span aria-hidden="true" className="ml-1">
              ↗
            </span>
          </a>
        )}

        <dl className="mt-6 grid grid-cols-2 gap-4 rounded-control bg-surface p-4 sm:grid-cols-4">
          <InfoItem label="Loại cơ hội" value={item.type} />
          <InfoItem label="Hạn nộp" value={deadlineLabel(item)} />
          <InfoItem
            label="Hình thức"
            value={item.workFormat ?? 'Chưa có thông tin'}
          />
          <InfoItem
            label="Địa điểm"
            value={item.location ?? 'Chưa có thông tin'}
          />
        </dl>

        <div className="mt-7 grid gap-6">
          <ContentBlock title="Mô tả" content={item.descriptionText} />
          <ContentBlock title="Yêu cầu" content={item.requirementsText} />
        </div>

        {(item.majors.length > 0 ||
          item.skills.length > 0 ||
          item.eligibleAcademicYears.length > 0) && (
          <section className="mt-7 border-t border-line pt-5">
            <h3 className="type-title text-navy">Đối tượng và kỹ năng</h3>
            {item.majors.length > 0 && (
              <TagGroup
                label="Chuyên ngành"
                values={item.majors.map((major) => major.name)}
              />
            )}
            {item.skills.length > 0 && (
              <TagGroup
                label="Kỹ năng liên quan"
                values={item.skills.map((skill) => skill.name)}
              />
            )}
            {item.eligibleAcademicYears.length > 0 && (
              <p className="mt-3 type-label text-secondary">
                Năm học: {item.eligibleAcademicYears.join(', ')}
              </p>
            )}
          </section>
        )}

        <p className="mt-6 type-caption text-muted">
          Gửi lúc {formatCreatedAt(item.createdAt)}
        </p>
        {item.status !== 'Pending' && item.reviewedAt && (
          <p className="mt-1 type-caption text-secondary">
            Đã xử lý lúc {formatCreatedAt(item.reviewedAt)}
          </p>
        )}

        {reviewable && (
          <div className="mt-6 border-t border-line pt-5">
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => {
                  setLocalError(null);
                  onClearErrors();
                  setRejectOpen(true);
                }}
              >
                Từ chối
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => onApprove(false)}
              >
                Duyệt (không cấp nhãn)
              </Button>
              <Button loading={busy} onClick={() => onApprove(true)}>
                Duyệt và cấp nhãn Verified
              </Button>
            </div>
          </div>
        )}
      </Card>

      {rejectOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-title"
            className="w-full max-w-xl rounded-card border border-line bg-white p-6 shadow-card"
          >
            <h2 id="reject-title" className="type-title text-navy">
              Từ chối cơ hội
            </h2>
            <p className="mt-2 type-label text-secondary">
              Lý do là bắt buộc và có tối đa 500 ký tự.
            </p>
            <FormField
              id="reject-reason"
              label="Lý do từ chối"
              required
              error={localError ?? validationError ?? undefined}
            >
              <textarea
                id="reject-reason"
                value={reason}
                required
                maxLength={1000}
                rows={5}
                onChange={(event) => {
                  setReason(event.target.value);
                  setLocalError(null);
                }}
                className="w-full resize-y rounded-control border border-control bg-white p-3 type-body text-ink focus-visible:border-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand aria-[invalid=true]:border-danger aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-danger"
              />
            </FormField>
            <p className="mt-1 text-right type-caption text-muted">
              {Array.from(reason).length}/500
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setRejectOpen(false)}
              >
                Hủy
              </Button>
              <Button
                variant="danger"
                loading={busy}
                onClick={async () => {
                  const clean = reason.trim();
                  if (!clean) {
                    setLocalError('Vui lòng nhập lý do từ chối.');
                    return;
                  }
                  if (Array.from(clean).length > 500) {
                    setLocalError(
                      'Lý do từ chối không được vượt quá 500 ký tự.',
                    );
                    return;
                  }
                  if (await onReject(clean)) setRejectOpen(false);
                }}
              >
                Xác nhận từ chối
              </Button>
            </div>
          </section>
        </div>
      )}
    </article>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="type-caption text-muted">{label}</dt>
      <dd className="mt-1 break-words type-label font-semibold text-ink">
        {value}
      </dd>
    </div>
  );
}

function TagGroup({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="mt-3">
      <h4 className="type-caption font-semibold uppercase text-secondary">
        {label}
      </h4>
      <ul className="mt-2 flex flex-wrap gap-2">
        {values.map((value, index) => (
          <li key={`${value}-${index}`}>
            <Badge variant="neutral">{value}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminOpportunitiesPage() {
  const { id } = useParams();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = currentPage(searchParams.get('page'));
  const [queue, setQueue] = useState<QueueState>({ status: 'loading' });
  const [detail, setDetail] = useState<DetailState>({ status: 'loading' });
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState<ReviewChoice>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const hasDetail = Boolean(id);
  const validId = !id || isValidId(id);
  const detailRetry = useMemo(
    () => () => setRevision((value) => value + 1),
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setQueue({ status: 'loading' });
    getPendingOpportunities(page, controller.signal)
      .then((data) => {
        if (active) setQueue({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if (active && !controller.signal.aborted)
          setQueue({ status: 'error', error });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [page, revision]);

  useEffect(() => {
    if (!id) {
      setDetail({ status: 'loading' });
      return;
    }
    if (!validId) {
      setDetail({ status: 'invalid-id' });
      return;
    }
    const controller = new AbortController();
    let active = true;
    setDetail({ status: 'loading' });
    getAdminOpportunity(id, controller.signal)
      .then((data) => {
        if (active) setDetail({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if (active && !controller.signal.aborted)
          setDetail({ status: 'error', error });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [id, validId, revision]);

  function changePage(nextPage: number) {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(nextPage));
    setSearchParams(next);
  }

  async function runMutation(run: () => Promise<unknown>): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setMutationError(null);
    setValidationError(null);
    setNotice(null);
    try {
      await run();
      setChoice(null);
      setNotice('Đã xử lý cơ hội. Hàng chờ và chi tiết đang được cập nhật.');
      setRevision((value) => value + 1);
      return true;
    } catch (error) {
      const code = errorCode(error);
      if (code === 'OPPORTUNITY_NOT_PENDING') {
        setNotice(
          'Cơ hội vừa được xử lý bởi một quản trị viên khác. Dữ liệu đã được tải lại.',
        );
        setRevision((value) => value + 1);
      } else if (code === 'VALIDATION_ERROR' || code === 'INVALID_REQUEST') {
        setValidationError(errorMessage(error));
      } else if (code === 'OPPORTUNITY_NOT_REVIEWABLE') {
        setMutationError(
          'Cơ hội chưa đủ điều kiện để duyệt. Hãy kiểm tra nguồn, nội dung và địa điểm bắt buộc.',
        );
      } else {
        setMutationError(errorMessage(error));
      }
      return false;
    } finally {
      setBusy(false);
    }
  }

  const backToQueue = `/admin/opportunities${location.search}`;

  return (
    <div className="mx-auto w-full max-w-[1600px]">
      <header className="mb-6 border-b border-line pb-5">
        <p className="type-label font-medium text-navy">Kiểm duyệt nội dung</p>
        <h1 className="mt-1 type-title text-navy">Thẩm định cơ hội</h1>
        <p className="mt-2 type-body text-secondary">
          Xem thông tin đã gửi và quyết định duyệt hoặc từ chối theo hợp đồng.
        </p>
      </header>

      <nav
        aria-label="Khu vực kiểm duyệt"
        className="mb-6 border-b border-line"
      >
        <span
          aria-current="page"
          className="inline-flex min-h-10 items-center border-b-2 border-brand px-1 type-label font-medium text-brand"
        >
          Tin chờ thẩm định
        </span>
        <span
          className="ml-6 inline-flex min-h-10 items-center px-1 type-label text-muted"
          aria-disabled="true"
        >
          Giám sát cộng đồng (chưa triển khai)
        </span>
      </nav>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(280px,0.48fr)_minmax(0,1fr)]">
        <ReviewQueue
          state={queue}
          selectedId={id}
          page={page}
          onPageChange={changePage}
          onRetry={() => setRevision((value) => value + 1)}
        />
        <section className="min-w-0" aria-label="Chi tiết đang chọn">
          {!hasDetail && (
            <EmptyState
              title="Chọn một cơ hội để thẩm định"
              description="Chi tiết và các thao tác duyệt sẽ hiển thị tại đây."
            />
          )}
          {hasDetail && (
            <>
              <Link
                to={backToQueue}
                className="mb-3 inline-flex min-h-9 items-center type-label font-medium text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                ← Quay lại hàng chờ
              </Link>
              <AdminOpportunityDetail
                detail={detail}
                onRetry={detailRetry}
                onApprove={(verified) => setChoice({ verified })}
                onReject={(reason) =>
                  runMutation(() => rejectAdminOpportunity(Number(id), reason))
                }
                busy={busy}
                notice={notice}
                error={mutationError}
                validationError={validationError}
                onClearNotice={() => setNotice(null)}
                onClearErrors={() => {
                  setValidationError(null);
                  setMutationError(null);
                }}
              />
            </>
          )}
        </section>
      </div>

      <ReviewDialog
        choice={choice}
        onCancel={() => setChoice(null)}
        onConfirm={() => {
          if (choice && id)
            void runMutation(() =>
              approveAdminOpportunity(Number(id), choice.verified),
            );
        }}
        busy={busy}
      />
    </div>
  );
}
