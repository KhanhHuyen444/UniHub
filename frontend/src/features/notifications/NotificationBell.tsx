import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/ui/FeedbackStates';
import notificationIcon from '../../assets/notification.svg';
import { useAuth } from '../auth/AuthProvider';
import { getAuthSnapshot, subscribeToAuth } from '../auth/auth-state';
import {
  listNotifications,
  getNotificationEvent,
  type NotificationEvent,
  markNotificationRead,
  notificationDestination,
  type NotificationItem,
  type NotificationPage,
} from './api';

export function NotificationBell({ preview = false }: { preview?: boolean }) {
  const { user, status } = useAuth();
  const [open, setOpen] = useState(false);
  const available =
    !preview && status === 'authenticated' && user?.role === 'Student';
  return (
    <>
      <Button
        variant="text"
        size="icon"
        disabled={!available}
        aria-label="Thông báo"
        aria-haspopup="dialog"
        aria-expanded={available && open}
        onClick={() => setOpen(true)}
      >
        <img
          src={notificationIcon}
          alt=""
          width={16}
          height={20}
          className="h-5 w-4"
        />
      </Button>
      {available && open && (
        <NotificationPanel key={user.id} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const lifetime = useRef<AbortController | null>(null);
  const request = useRef(0);
  const active = useRef(false);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<NotificationPage | null>(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [event, setEvent] = useState<NotificationEvent | null>(null);
  const eventHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (event) eventHeading.current?.focus();
  }, [event]);
  const navigate = useNavigate();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const controller = new AbortController();
    lifetime.current = controller;
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
    dialog.current?.showModal();
    return () => {
      controller.abort();
      unsubscribe();
      dialog.current?.close();
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const parent = lifetime.current?.signal;
    const abort = () => controller.abort();
    parent?.addEventListener('abort', abort);
    if (parent?.aborted) controller.abort();
    const id = ++request.current;
    setData(null);
    setError('');
    setActionError('');
    listNotifications(page, controller.signal).then(
      (value) => {
        if (!controller.signal.aborted && id === request.current)
          setData(value);
      },
      (err) => {
        if (!controller.signal.aborted && id === request.current)
          setError(
            err instanceof Error ? err.message : 'Không tải được thông báo.',
          );
      },
    );
    return () => {
      controller.abort();
      parent?.removeEventListener('abort', abort);
    };
  }, [page, attempt]);
  async function select(item: NotificationItem) {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted || active.current) return;
    active.current = true;
    setBusy(true);
    setActionError('');
    try {
      await markNotificationRead(item.id, signal);
      if (signal.aborted) return;
      setData((current) =>
        current
          ? {
              ...current,
              items: current.items.map((row) =>
                row.id === item.id ? { ...row, isRead: true } : row,
              ),
              unreadCount: Math.max(
                0,
                current.unreadCount - (item.isRead ? 0 : 1),
              ),
            }
          : current,
      );
      const destination = notificationDestination(item);
      if (destination) {
        onClose();
        navigate(destination);
      } else {
        const detail = await getNotificationEvent(item.eventId!, signal);
        if (!signal.aborted) setEvent(detail);
      }
    } catch (err) {
      if (!signal.aborted)
        setActionError(
          err instanceof Error ? err.message : 'Không đánh dấu được thông báo.',
        );
    } finally {
      active.current = false;
      if (!signal.aborted) setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      aria-labelledby="notifications-title"
      className="m-auto max-h-[85vh] w-[min(520px,calc(100vw-32px))] overflow-y-auto rounded-card border border-line bg-white p-6 text-ink shadow-card backdrop:bg-black/40"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id="notifications-title" className="text-xl font-semibold">
          Thông báo{data ? ` (${data.unreadCount} chưa đọc)` : ''}
        </h2>
        <Button
          variant="text"
          size="icon"
          aria-label="Đóng thông báo"
          onClick={onClose}
        >
          ×
        </Button>
      </div>
      {actionError && (
        <p role="alert" className="mb-3 text-danger">
          {actionError}
        </p>
      )}
      {event ? (
        <section aria-labelledby="notification-event-title">
          <h3
            id="notification-event-title"
            ref={eventHeading}
            tabIndex={-1}
            className="text-lg font-semibold"
          >
            {event.title}
          </h3>
          <p className="mt-3">
            Hạn chót:{' '}
            {new Intl.DateTimeFormat('vi-VN', {
              timeZone: 'Asia/Ho_Chi_Minh',
              dateStyle: 'short',
              timeStyle: 'short',
            }).format(new Date(event.dueDate))}{' '}
            (giờ Việt Nam)
          </p>
          {event.notes && (
            <p className="my-3 whitespace-pre-wrap break-words">
              {event.notes}
            </p>
          )}
          <Button
            variant="neutral"
            onClick={() => {
              setEvent(null);
              setAttempt((v) => v + 1);
            }}
          >
            Quay lại thông báo
          </Button>
        </section>
      ) : error ? (
        <ErrorState
          title="Không tải được thông báo"
          description={error}
          onRetry={() => setAttempt((v) => v + 1)}
        />
      ) : !data ? (
        <LoadingState title="Đang tải thông báo…" />
      ) : (
        <>
          {data.items.length === 0 ? (
            <EmptyState
              title="Không có thông báo"
              description="Không có thông báo trong trang này."
            />
          ) : (
            <ul className="grid gap-2">
              {data.items.map((item) => (
                <li key={item.id}>
                  <button
                    disabled={busy}
                    onClick={() => void select(item)}
                    className={`w-full rounded-control border border-line p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50 ${item.isRead ? 'bg-white' : 'bg-cyan'}`}
                  >
                    <span className="block text-xs text-secondary">
                      {item.type === 'Reminder'
                        ? 'Nhắc hạn'
                        : 'Thông báo vi phạm'}{' '}
                      · {item.isRead ? 'Đã đọc' : 'Chưa đọc'}
                    </span>
                    <span className="mt-1 block whitespace-pre-wrap break-words">
                      {item.content}
                    </span>
                    <time
                      dateTime={item.createdAt}
                      className="mt-1 block text-xs text-muted"
                    >
                      {new Intl.DateTimeFormat('vi-VN', {
                        timeZone: 'Asia/Ho_Chi_Minh',
                        dateStyle: 'short',
                        timeStyle: 'short',
                      }).format(new Date(item.createdAt))}
                    </time>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <nav
            aria-label="Trang thông báo"
            className="mt-4 flex items-center justify-between gap-2"
          >
            <Button
              variant="neutral"
              disabled={busy || page === 1}
              onClick={() => setPage((v) => v - 1)}
            >
              Trang trước
            </Button>
            <span className="text-sm">
              Trang {page} / {data.meta.totalPages || 1}
            </span>
            <Button
              variant="neutral"
              disabled={busy || page >= data.meta.totalPages}
              onClick={() => setPage((v) => v + 1)}
            >
              Trang sau
            </Button>
          </nav>
        </>
      )}
      {busy && (
        <p role="status" className="mt-3 text-sm">
          Đang mở thông báo…
        </p>
      )}
    </dialog>
  );
}
