import { useEffect, useMemo, useRef, useState } from 'react';
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
import { isReviewTargetCurrent, lastValidQueuePage } from './contracts';

function CloseIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function CalendarIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}

function MapPinIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function BuildingIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
    </svg>
  );
}

function ShieldCheckIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 13c0 5-8 9-8 9s-8-4-8-9V5l8-3 8 3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function ExternalLinkIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

function BriefcaseIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function getTypeBadgeStyle(type: string): {
  bg: string;
  text: string;
  border: string;
} {
  const lower = type.toLowerCase();
  if (lower.includes('thực tập') || lower.includes('intern')) {
    return { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' };
  }
  if (lower.includes('việc làm') || lower.includes('job')) {
    return {
      bg: 'bg-indigo-50',
      text: 'text-indigo-700',
      border: 'border-indigo-200',
    };
  }
  if (lower.includes('học bổng') || lower.includes('scholarship')) {
    return {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
    };
  }
  if (
    lower.includes('cuộc thi') ||
    lower.includes('contest') ||
    lower.includes('sự kiện')
  ) {
    return {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
    };
  }
  return {
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
  };
}

type QueueState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'success'; data: PendingOpportunitiesResponse };

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'success'; data: AdminOpportunity }
  | { status: 'invalid-id' };

type ReviewChoice = { itemId: number; verified: boolean } | null;

function useDialogFocus(open: boolean, onDismiss: () => void) {
  const dialogRef = useRef<HTMLElement>(null);
  const dismissRef = useRef(onDismiss);

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!open) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focusable = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), textarea:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    const animation = window.requestAnimationFrame(() =>
      focusable()[0]?.focus(),
    );
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismissRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const targets = focusable();
      if (targets.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = targets[0];
      const last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(animation);
      document.removeEventListener('keydown', onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  return dialogRef;
}

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
  baseRoute = '/admin/moderation',
}: {
  state: QueueState;
  selectedId: string | undefined;
  page: number;
  onPageChange: (next: number) => void;
  onRetry: () => void;
  baseRoute?: string;
}) {
  return (
    <section aria-labelledby="queue-heading" className="min-w-0">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h2 id="queue-heading" className="type-title font-bold text-navy">
            Hàng đợi chờ thẩm định
          </h2>
          {state.status === 'success' && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
              {state.data.meta.total}
            </span>
          )}
        </div>
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
              const typeStyle = getTypeBadgeStyle(item.type);
              return (
                <li key={item.id}>
                  <Link
                    to={`${baseRoute}/${item.id}${window.location.search}`}
                    aria-current={selected ? 'page' : undefined}
                    className={`group relative block rounded-xl border bg-white p-4 shadow-xs transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                      selected
                        ? 'border-brand bg-gradient-to-r from-sky-50/50 via-white to-white shadow-md ring-2 ring-brand/20'
                        : 'border-line/80 hover:border-brand/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}
                      >
                        {item.type}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        #{item.id}
                      </span>
                    </div>
                    <h3 className="mt-2 line-clamp-2 text-sm font-bold text-navy transition-colors group-hover:text-brand">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 flex items-center gap-1.5 line-clamp-1 text-xs text-secondary">
                      <BuildingIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">
                        {item.publisher ?? 'Chưa có đơn vị đăng'}
                      </span>
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line/60 pt-2.5 text-xs text-secondary">
                      <span className="inline-flex items-center gap-1">
                        <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                        <span>Hạn nộp: {deadlineLabel(item)}</span>
                      </span>
                      {(item.workFormat || item.location) && (
                        <span className="inline-flex items-center gap-1">
                          <MapPinIcon className="h-3.5 w-3.5 text-slate-400" />
                          <span>
                            {item.workFormat ?? 'Chưa có hình thức'}
                            {item.location ? ` · ${item.location}` : ''}
                          </span>
                        </span>
                      )}
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
  const dialogRef = useDialogFocus(choice !== null, onCancel);
  if (choice === null) return null;
  return (
    <div
      ref={(element) => {
        dialogRef.current = element;
      }}
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
          Cơ hội #{choice.itemId}:{' '}
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
  routeId,
  onRetry,
  onApprove,
  rejectTargetId,
  onOpenReject,
  onCancelReject,
  onReject,
  busy,
  notice,
  error,
  validationError,
  onClearNotice,
  onClearErrors,
}: {
  detail: DetailState;
  routeId: string | undefined;
  onRetry: () => void;
  onApprove: (itemId: number, verified: boolean) => void;
  rejectTargetId: number | null;
  onOpenReject: (itemId: number) => void;
  onCancelReject: (itemId: number) => void;
  onReject: (itemId: number, reason: string) => Promise<boolean>;
  busy: boolean;
  notice: string | null;
  error: string | null;
  validationError: string | null;
  onClearNotice: () => void;
  onClearErrors: () => void;
}) {
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const loadedItemId = detail.status === 'success' ? detail.data.id : undefined;
  const rejectOpen = isReviewTargetCurrent(
    rejectTargetId,
    routeId,
    loadedItemId,
  );
  const rejectDialogRef = useDialogFocus(rejectOpen, () => {
    if (loadedItemId !== undefined) onCancelReject(loadedItemId);
  });

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
            title="Đóng thông báo"
            className="flex h-6 w-6 items-center justify-center rounded-sm text-info hover:bg-info/10 hover:scale-110 active:scale-95 transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            onClick={onClearNotice}
          >
            <CloseIcon className="h-4 w-4" />
            <span className="sr-only">Đóng thông báo</span>
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
      <Card className="p-6 md:p-8 transition-all duration-300 hover:shadow-md border-line/90">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/70 pb-4">
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
            {item.isVerified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                <ShieldCheckIcon className="h-3.5 w-3.5 text-emerald-600" />
                Verified
              </span>
            )}
          </div>
          <span className="text-xs font-mono text-slate-400">
            ID: #{item.id}
          </span>
        </div>
        <h2
          id="opportunity-title"
          className="mt-4 break-words text-2xl font-bold leading-8 text-navy"
        >
          {item.title}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-secondary">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
            <BuildingIcon className="h-4 w-4 text-slate-400" />
            {item.publisher ?? 'Chưa có đơn vị đăng'}
          </span>
          {item.sourceUrl && !item.sourceUrl.includes('.invalid') && (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <span>Xem nguồn tin gốc</span>
              <ExternalLinkIcon className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 rounded-control border border-line/60 bg-surface p-4 transition-all duration-200 hover:shadow-xs sm:grid-cols-4">
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
          <div className="mt-8 border-t border-line/80 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Thao tác thẩm định
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={() => {
                    setLocalError(null);
                    onClearErrors();
                    setReason('');
                    onOpenReject(item.id);
                  }}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <CloseIcon className="h-3.5 w-3.5" />
                    Từ chối
                  </span>
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => onApprove(item.id, false)}
                >
                  Duyệt (không cấp nhãn)
                </Button>
                <Button
                  loading={busy}
                  onClick={() => onApprove(item.id, true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheckIcon className="h-4 w-4" />
                    Duyệt và cấp nhãn Verified
                  </span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {rejectOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4">
          <section
            ref={(element) => {
              rejectDialogRef.current = element;
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-title"
            className="relative w-full max-w-xl rounded-card border border-line bg-white p-6 shadow-card"
          >
            <button
              type="button"
              aria-label="Đóng hộp thoại từ chối"
              title="Đóng"
              disabled={busy}
              onClick={() => onCancelReject(item.id)}
              className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-control text-secondary hover:bg-surface hover:text-navy hover:scale-110 active:scale-95 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 disabled:scale-100"
            >
              <CloseIcon className="h-4 w-4" />
              <span className="sr-only">Đóng</span>
            </button>
            <h2 id="reject-title" className="pr-8 type-title text-navy">
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
                onClick={() => onCancelReject(item.id)}
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
                  await onReject(item.id, clean);
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

export interface AdminOpportunitiesPageProps {
  showHeader?: boolean;
  showNav?: boolean;
  baseRoute?: string;
}

export function AdminOpportunitiesPage({
  showHeader = true,
  showNav = true,
  baseRoute = '/admin/moderation',
}: AdminOpportunitiesPageProps = {}) {
  const { id } = useParams();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = currentPage(searchParams.get('page'));
  const [queue, setQueue] = useState<QueueState>({ status: 'loading' });
  const [detail, setDetail] = useState<DetailState>({ status: 'loading' });
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState<ReviewChoice>(null);
  const [rejectTargetId, setRejectTargetId] = useState<number | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const activeRouteId = useRef(id);
  activeRouteId.current = id;
  const hasDetail = Boolean(id);
  const validId = !id || isValidId(id);
  const detailRetry = useMemo(
    () => () => setRevision((value) => value + 1),
    [],
  );

  useEffect(() => {
    setChoice(null);
    setRejectTargetId(null);
    setMutationError(null);
    setValidationError(null);
    setNotice(null);
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setQueue({ status: 'loading' });
    getPendingOpportunities(page, controller.signal)
      .then((data) => {
        if (!active) return;
        const correctedPage = lastValidQueuePage(page, data.meta.totalPages);
        if (correctedPage !== page) {
          setSearchParams(
            (current) => {
              const next = new URLSearchParams(current);
              next.set('page', String(correctedPage));
              return next;
            },
            { replace: true },
          );
          return;
        }
        setQueue({ status: 'success', data });
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

  async function runMutation(
    itemId: number,
    run: () => Promise<unknown>,
  ): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setMutationError(null);
    setValidationError(null);
    setNotice(null);
    try {
      await run();
      setChoice((current) => (current?.itemId === itemId ? null : current));
      setRejectTargetId((current) => (current === itemId ? null : current));
      if (activeRouteId.current === String(itemId)) {
        setNotice('Đã xử lý cơ hội. Hàng chờ và chi tiết đang được cập nhật.');
      }
      setRevision((value) => value + 1);
      return true;
    } catch (error) {
      const code = errorCode(error);
      if (code === 'OPPORTUNITY_NOT_PENDING') {
        if (activeRouteId.current === String(itemId)) {
          setNotice(
            'Cơ hội vừa được xử lý bởi một quản trị viên khác. Dữ liệu đã được tải lại.',
          );
        }
        setRevision((value) => value + 1);
      } else if (code === 'VALIDATION_ERROR' || code === 'INVALID_REQUEST') {
        if (activeRouteId.current === String(itemId)) {
          setValidationError(errorMessage(error));
        }
      } else if (code === 'OPPORTUNITY_NOT_REVIEWABLE') {
        if (activeRouteId.current === String(itemId)) {
          setMutationError(
            'Cơ hội chưa đủ điều kiện để duyệt. Hãy kiểm tra nguồn, nội dung và địa điểm bắt buộc.',
          );
        }
      } else {
        if (activeRouteId.current === String(itemId)) {
          setMutationError(errorMessage(error));
        }
      }
      return false;
    } finally {
      setBusy(false);
    }
  }

  const backToQueue = `${baseRoute}${location.search}`;

  return (
    <div className="mx-auto w-full max-w-[1600px]">
      {showHeader && (
        <header className="mb-6 border-b border-line pb-5">
          <p className="type-label font-medium text-navy">
            Kiểm duyệt nội dung
          </p>
          <h1 className="mt-1 type-title text-navy">Thẩm định cơ hội</h1>
          <p className="mt-2 type-body text-secondary">
            Xem thông tin đã gửi và quyết định duyệt hoặc từ chối theo hợp đồng.
          </p>
        </header>
      )}

      {showNav && (
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
          <Link
            to="/admin/moderation?tab=community"
            className="ml-6 inline-flex min-h-10 items-center px-1 type-label text-secondary hover:text-brand"
          >
            Giám sát cộng đồng
          </Link>
        </nav>
      )}

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(280px,0.48fr)_minmax(0,1fr)]">
        <ReviewQueue
          state={queue}
          selectedId={id}
          page={page}
          onPageChange={changePage}
          onRetry={() => setRevision((value) => value + 1)}
          baseRoute={baseRoute}
        />
        <section className="min-w-0" aria-label="Chi tiết đang chọn">
          {!hasDetail && (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-gradient-to-b from-slate-50/50 via-white to-slate-50/30 p-12 text-center shadow-xs">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-brand ring-1 ring-sky-100">
                <BriefcaseIcon className="h-7 w-7 text-brand" />
              </div>
              <h3 className="mt-4 text-base font-bold text-navy">
                Chọn một cơ hội để thẩm định
              </h3>
              <p className="mt-1.5 max-w-sm text-sm text-secondary">
                Chi tiết và các thao tác duyệt sẽ hiển thị tại đây.
              </p>
            </div>
          )}
          {hasDetail && (
            <>
              <Link
                to={backToQueue}
                className="mb-3 inline-flex min-h-9 items-center type-label font-medium text-brand hover:underline hover:-translate-x-1 transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                ← Quay lại hàng chờ
              </Link>
              <AdminOpportunityDetail
                key={id}
                detail={detail}
                routeId={id}
                onRetry={detailRetry}
                onApprove={(itemId, verified) =>
                  setChoice({ itemId, verified })
                }
                rejectTargetId={rejectTargetId}
                onOpenReject={setRejectTargetId}
                onCancelReject={(itemId) => {
                  setRejectTargetId((current) =>
                    current === itemId ? null : current,
                  );
                }}
                onReject={(itemId, reason) =>
                  runMutation(itemId, () =>
                    rejectAdminOpportunity(itemId, reason),
                  )
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
        choice={
          detail.status === 'success' &&
          isReviewTargetCurrent(choice?.itemId ?? null, id, detail.data.id)
            ? choice
            : null
        }
        onCancel={() => setChoice(null)}
        onConfirm={() => {
          if (
            choice &&
            isReviewTargetCurrent(
              choice.itemId,
              id,
              detail.status === 'success' ? detail.data.id : undefined,
            )
          ) {
            void runMutation(choice.itemId, () =>
              approveAdminOpportunity(choice.itemId, choice.verified),
            );
          }
        }}
        busy={busy}
      />
    </div>
  );
}

export const OpportunityModerationView = AdminOpportunitiesPage;
