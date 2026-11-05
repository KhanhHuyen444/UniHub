import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../../lib/api';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../../components/ui';
import { AdminLayout } from '../../../layouts/AdminLayout';
import { formatForumDate } from '../../forum/contracts';
import { getForumModerationQueue, removeModerationTarget } from './api';
import type { ModerationQueueItem, ModerationQueueResponse } from './contracts';

type QueueState =
  | { status: 'loading' }
  | { status: 'error'; code: string }
  | { status: 'success'; data: ModerationQueueResponse };

const pageSize = 20;

function queueErrorCopy(code: string): { title: string; description: string } {
  if (code === 'UNAUTHORIZED') {
    return {
      title: 'Phiên quản trị đã hết hạn',
      description:
        'Vui lòng đăng nhập lại bằng tài khoản quản trị rồi thử lại.',
    };
  }
  if (code === 'FORBIDDEN') {
    return {
      title: 'Không có quyền xem hàng đợi',
      description: 'Chỉ quản trị viên được phép truy cập khu vực kiểm duyệt.',
    };
  }
  return {
    title: 'Chưa thể tải hàng đợi kiểm duyệt',
    description: 'Đã xảy ra lỗi khi kết nối máy chủ. Vui lòng thử lại.',
  };
}

function removeErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Phiên quản trị không còn hợp lệ. Hãy đăng nhập lại rồi thử lại.';
    }
    if (error.status === 403) {
      return 'Tài khoản hiện tại không có quyền gỡ nội dung.';
    }
    if (error.status === 404) {
      return 'Không tìm thấy nội dung. Hàng đợi chưa được thay đổi; hãy tải lại để kiểm tra.';
    }
    if (error.status === 409 || error.code === 'CONTENT_ALREADY_REMOVED') {
      return 'Nội dung đã được xử lý bởi quản trị viên khác. Hàng đợi chưa được thay đổi; hãy tải lại để kiểm tra.';
    }
    if (error.code === 'VALIDATION_ERROR' || error.code === 'INVALID_REQUEST') {
      return 'Lý do gỡ chưa hợp lệ. Hãy kiểm tra nội dung rồi thử lại.';
    }
  }
  return 'Không thể lưu thao tác gỡ nội dung. Bản ghi vẫn được giữ trong hàng đợi; vui lòng thử lại.';
}

function FileTextIcon({ className = 'h-4 w-4' }: { className?: string }) {
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
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
      <line x1="10" x2="8" y1="9" y2="9" />
    </svg>
  );
}

function MessageCircleIcon({ className = 'h-4 w-4' }: { className?: string }) {
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
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}

function TrashIcon({ className = 'h-4 w-4' }: { className?: string }) {
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
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function AuthorAvatar({ item }: { item: ModerationQueueItem }) {
  const { fullName, avatarUrl } = item.author;
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        aria-hidden="true"
        className="h-10 w-10 rounded-full object-cover ring-2 ring-slate-100"
      />
    );
  }
  const initial = fullName.trim().charAt(0).toUpperCase() || 'U';
  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 font-bold text-white shadow-xs"
    >
      {initial}
    </span>
  );
}

function QueueItemCard({
  item,
  onRemove,
}: {
  item: ModerationQueueItem;
  onRemove: (item: ModerationQueueItem) => void;
}) {
  const isPost = item.targetType === 'Post';
  return (
    <Card className="rounded-xl border border-line/90 p-5 md:p-6 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300">
      <article className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-bold ${
                isPost
                  ? 'border-sky-200 bg-sky-50 text-sky-700'
                  : 'border-amber-200 bg-amber-50 text-amber-700'
              }`}
            >
              {isPost ? (
                <>
                  <FileTextIcon className="h-3.5 w-3.5" />
                  BÀI VIẾT
                </>
              ) : (
                <>
                  <MessageCircleIcon className="h-3.5 w-3.5" />
                  BÌNH LUẬN
                </>
              )}
            </span>
            {isPost && <Badge variant="success">{item.topic}</Badge>}
          </div>
          <time
            dateTime={item.createdAt}
            className="type-caption text-secondary"
          >
            {formatForumDate(item.createdAt)}
          </time>
        </div>

        {isPost ? (
          <div>
            <h2 className="type-title font-semibold text-navy">{item.title}</h2>
            <p className="mt-2 whitespace-pre-wrap type-body text-secondary">
              {item.content}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="rounded-lg border-l-4 border-amber-400 bg-amber-50/50 p-3">
              <p className="type-caption font-semibold uppercase text-amber-800">
                Bình luận trong bài viết
              </p>
              <h2 className="mt-0.5 type-label font-semibold text-navy">
                {item.post.title}
              </h2>
            </div>
            <p className="mt-2 whitespace-pre-wrap type-body text-secondary">
              {item.content}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line/80 pt-4">
          <div className="flex min-w-0 items-center gap-3">
            <AuthorAvatar item={item} />
            <div className="min-w-0">
              <p className="truncate type-label font-semibold text-ink">
                {item.author.fullName}
              </p>
              <p className="type-caption text-muted">
                {isPost ? 'Tác giả bài viết' : 'Người bình luận'}
              </p>
            </div>
          </div>
          <Button
            variant="danger"
            onClick={() => onRemove(item)}
            aria-label={`${isPost ? 'Gỡ bài viết' : 'Gỡ bình luận'}: ${isPost ? item.title : item.post.title}`}
          >
            <span className="inline-flex items-center gap-1.5">
              <TrashIcon className="h-3.5 w-3.5" />
              Gỡ {isPost ? 'bài viết' : 'bình luận'}
            </span>
          </Button>
        </div>
      </article>
    </Card>
  );
}

export interface ModerationQueueProps {
  showHeader?: boolean;
}

export function ModerationQueue({
  showHeader = true,
}: ModerationQueueProps = {}) {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [queue, setQueue] = useState<QueueState>({ status: 'loading' });
  const [target, setTarget] = useState<ModerationQueueItem | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setQueue({ status: 'loading' });
    getForumModerationQueue(page, controller.signal)
      .then((data) => {
        if (!active) return;
        if (data.meta.totalPages > 0 && page > data.meta.totalPages) {
          setPage(data.meta.totalPages);
          return;
        }
        if (data.meta.totalPages === 0 && page !== 1) {
          setPage(1);
          return;
        }
        setQueue({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted) return;
        setQueue({
          status: 'error',
          code: error instanceof ApiError ? error.code : 'UNKNOWN_ERROR',
        });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [page, revision]);

  function openRemoval(item: ModerationQueueItem) {
    setTarget(item);
    setReason('');
    setReasonError(null);
    setRemoveError(null);
  }

  function closeRemoval() {
    if (isRemoving) return;
    setTarget(null);
    setReason('');
    setReasonError(null);
    setRemoveError(null);
  }

  async function confirmRemoval(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target || isRemoving) return;
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setReasonError('Vui lòng nhập lý do gỡ nội dung.');
      setRemoveError(null);
      return;
    }
    if ([...trimmedReason].length > 500) {
      setReasonError('Lý do gỡ không được vượt quá 500 ký tự.');
      setRemoveError(null);
      return;
    }

    setReasonError(null);
    setRemoveError(null);
    setIsRemoving(true);
    try {
      await removeModerationTarget(target.targetType, target.id, trimmedReason);
      const label = target.targetType === 'Post' ? 'bài viết' : 'bình luận';
      setSuccessMessage(`Đã gỡ ${label} thành công.`);
      setQueue((current) => {
        if (current.status !== 'success') return current;
        const total = Math.max(0, current.data.meta.total - 1);
        const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
        return {
          status: 'success',
          data: {
            items: current.data.items.filter(
              (item) =>
                item.targetType !== target.targetType || item.id !== target.id,
            ),
            meta: {
              ...current.data.meta,
              total,
              totalPages,
            },
          },
        };
      });
      setTarget(null);
      setReason('');
      const currentData = queue.status === 'success' ? queue.data : null;
      const nextTotal = Math.max(0, (currentData?.meta.total ?? 1) - 1);
      const nextPages = nextTotal === 0 ? 0 : Math.ceil(nextTotal / pageSize);
      if (page > Math.max(1, nextPages)) setPage(Math.max(1, nextPages));
      setRevision((current) => current + 1);
    } catch (error) {
      setRemoveError(removeErrorMessage(error));
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <div className="space-y-6">
      {showHeader && (
        <header className="border-b border-line pb-5">
          <p className="type-caption font-semibold uppercase tracking-wide text-brand">
            Kiểm duyệt nội dung
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="type-display text-navy">Giám sát cộng đồng</h1>
              <p className="mt-2 max-w-3xl type-body text-secondary">
                Rà soát bài viết và bình luận trong diễn đàn sinh viên.
              </p>
            </div>
            {queue.status === 'success' && (
              <p className="type-label text-secondary">
                {queue.data.meta.total} nội dung cần xử lý
              </p>
            )}
          </div>
        </header>
      )}

      {!showHeader && queue.status === 'success' && (
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <h2 className="type-title font-bold text-navy">Hàng đợi vi phạm</h2>
            <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-800">
              {queue.data.meta.total}
            </span>
          </div>
          <p className="type-caption text-secondary">
            Hiển thị {queue.data.items.length} / {queue.data.meta.total} nội
            dung
          </p>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="flex items-center justify-between gap-4 rounded-control border border-green-200 bg-green-100 px-4 py-3 type-label text-green-800"
        >
          <span>{successMessage}</span>
          <button
            type="button"
            aria-label="Đóng thông báo"
            onClick={() => setSuccessMessage(null)}
            className="rounded-sm px-2 text-lg leading-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          >
            ×
          </button>
        </div>
      )}

      {queue.status === 'loading' && (
        <LoadingState
          title="Đang tải nội dung cần xử lý"
          description="Vui lòng chờ trong giây lát..."
        />
      )}
      {queue.status === 'error' && (
        <ErrorState
          title={queueErrorCopy(queue.code).title}
          description={queueErrorCopy(queue.code).description}
          onRetry={() => setRevision((current) => current + 1)}
        />
      )}
      {queue.status === 'success' && queue.data.items.length === 0 && (
        <EmptyState
          title="Không có nội dung cần xử lý"
          description="Các bài viết và bình luận đang hiển thị đều đã được rà soát."
        />
      )}
      {queue.status === 'success' && queue.data.items.length > 0 && (
        <section
          aria-label="Danh sách nội dung cần xử lý"
          className="space-y-4"
        >
          {queue.data.items.map((item) => (
            <QueueItemCard
              key={`${item.targetType}-${item.id}`}
              item={item}
              onRemove={openRemoval}
            />
          ))}
          {queue.data.meta.totalPages > 1 && (
            <nav
              aria-label="Phân trang hàng đợi kiểm duyệt"
              className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"
            >
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Trước
              </Button>
              <span className="type-label text-secondary">
                Trang {queue.data.meta.page} / {queue.data.meta.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={page >= queue.data.meta.totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Tiếp
              </Button>
            </nav>
          )}
        </section>
      )}

      {target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/55 px-4 py-6 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="moderation-dialog-title"
            className="my-auto w-full max-w-xl rounded-card bg-white p-6 shadow-[0_20px_60px_rgba(3,4,94,0.2)] sm:p-7"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2
                  id="moderation-dialog-title"
                  className="type-title text-navy"
                >
                  {target.targetType === 'Post'
                    ? 'Gỡ bài viết'
                    : 'Gỡ bình luận'}
                </h2>
                <p className="mt-2 type-label text-secondary">
                  {target.targetType === 'Post'
                    ? `Bạn đang xử lý bài viết “${target.title}”. Nội dung sẽ được ẩn khỏi diễn đàn.`
                    : `Bạn đang xử lý bình luận trong bài “${target.post.title}”. Bình luận sẽ được ẩn khỏi diễn đàn.`}
                </p>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                disabled={isRemoving}
                onClick={closeRemoval}
                className="rounded-control px-2 text-xl text-secondary hover:bg-surface disabled:opacity-50"
              >
                ×
              </button>
            </div>

            {removeError && (
              <div
                role="alert"
                className="mb-5 rounded-control border border-danger-line bg-danger-surface px-4 py-3 type-label text-danger"
              >
                {removeError}
              </div>
            )}

            <form onSubmit={(event) => void confirmRemoval(event)} noValidate>
              <label
                htmlFor="moderation-removal-reason"
                className="type-label font-medium text-secondary"
              >
                Lý do gỡ nội dung <span className="text-danger">*</span>
              </label>
              <textarea
                id="moderation-removal-reason"
                value={reason}
                disabled={isRemoving}
                rows={4}
                aria-invalid={Boolean(reasonError)}
                aria-describedby={
                  reasonError
                    ? 'moderation-reason-error'
                    : 'moderation-reason-hint'
                }
                placeholder="Nhập lý do gỡ nội dung..."
                onChange={(event) => {
                  setReason(event.target.value);
                  setReasonError(null);
                  setRemoveError(null);
                }}
                className="mt-2 w-full resize-y rounded-control border border-control bg-white px-3 py-3 type-body text-ink placeholder:text-placeholder focus-visible:border-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand aria-[invalid=true]:border-danger aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-danger disabled:bg-surface"
              />
              <div className="mt-2 flex items-start justify-between gap-4">
                {reasonError ? (
                  <p
                    id="moderation-reason-error"
                    role="alert"
                    className="type-caption font-medium text-danger"
                  >
                    {reasonError}
                  </p>
                ) : (
                  <p
                    id="moderation-reason-hint"
                    className="type-caption text-muted"
                  >
                    Bắt buộc, tối đa 500 ký tự.
                  </p>
                )}
                <span className="shrink-0 type-caption text-muted">
                  {[...reason].length}/500
                </span>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <Button
                  variant="outline"
                  disabled={isRemoving}
                  onClick={closeRemoval}
                >
                  Hủy
                </Button>
                <Button type="submit" variant="danger" loading={isRemoving}>
                  {isRemoving ? 'Đang xử lý…' : 'Xác nhận gỡ'}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export function AdminForumModerationPage() {
  return (
    <AdminLayout activeKey="forum-moderation">
      <ModerationQueue />
    </AdminLayout>
  );
}

export const CommunityModerationView = ModerationQueue;
