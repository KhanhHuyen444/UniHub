import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { FormField } from '../../components/ui/FormField';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/ui/FeedbackStates';
import { StudentLayout } from '../../layouts/StudentLayout';
import { useAuth } from '../auth/AuthProvider';
import { getAuthSnapshot, subscribeToAuth } from '../auth/auth-state';
import * as api from './api';
import {
  calendarRange,
  displayDate,
  eventDraft,
  eventError,
  localDate,
  prepareEvent,
  shiftMonth,
  statusLabels,
  type CalendarEvent,
  type EventDraft,
  type EventStatus,
} from './model';
import './calendar.css';

const tones: Record<EventStatus, string> = {
  Upcoming: 'calendar-upcoming',
  Overdue: 'calendar-overdue',
  Completed: 'calendar-completed',
};

function Dialog({
  title,
  children,
  onClose,
  busy = false,
  small = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  small?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => {
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`calendar-dialog ${small ? 'calendar-dialog-small' : ''}`}
      aria-labelledby="calendar-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <h2
          id="calendar-dialog-title"
          className="text-2xl font-semibold text-navy"
        >
          {title}
        </h2>
        <Button
          variant="text"
          size="icon"
          aria-label="Đóng"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </Button>
      </div>
      {children}
    </dialog>
  );
}

function EventForm({
  original,
  date,
  onClose,
  onSaved,
  signal,
}: {
  original?: CalendarEvent;
  date: string;
  onClose: () => void;
  onSaved: () => void;
  signal: AbortSignal;
}) {
  const [draft, setDraft] = useState(() => eventDraft(original, date));
  const [errors, setErrors] = useState<
    Partial<Record<keyof EventDraft, string>>
  >({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const update = (field: keyof EventDraft, value: string) =>
    setDraft((d) => ({ ...d, [field]: value }));
  return (
    <Dialog
      title={original ? 'Chỉnh sửa sự kiện' : 'Thêm sự kiện mới'}
      onClose={onClose}
      busy={busy}
    >
      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || signal.aborted) return;
          const result = prepareEvent(draft, original);
          setErrors(result.errors);
          setError('');
          if (Object.keys(result.errors).length) {
            requestAnimationFrame(() =>
              document
                .querySelector<HTMLElement>('[aria-invalid="true"]')
                ?.focus(),
            );
            return;
          }
          if (original && !Object.keys(result.patch).length) {
            onClose();
            return;
          }
          setBusy(true);
          try {
            if (original)
              await api.editEvent(original.id, result.patch, signal);
            else await api.createEvent(result.input, signal);
            if (!signal.aborted) onSaved();
          } catch (err) {
            if (!signal.aborted) setError(eventError(err));
          } finally {
            if (!signal.aborted) setBusy(false);
          }
        }}
        className="grid gap-4"
      >
        {original && (
          <p className="-mt-4 text-sm text-muted">
            Cập nhật hạn chót hoặc nội dung sự kiện
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-danger-line bg-danger-surface p-3 text-sm text-danger"
          >
            Không thể lưu sự kiện. {error}
          </p>
        )}
        <fieldset disabled={busy} className="grid gap-4">
          <FormField
            id="event-title"
            label="Tiêu đề"
            required
            error={errors.title}
          >
            <Input
              autoFocus
              maxLength={255}
              placeholder="Nhập tên bài tập, kỳ thi hoặc hạn nộp…"
              value={draft.title}
              onChange={(e) => update('title', e.target.value)}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              id="event-date"
              label="Hạn chót"
              required
              error={errors.date}
            >
              <Input
                type="date"
                value={draft.date}
                onChange={(e) => update('date', e.target.value)}
              />
            </FormField>
            <FormField
              id="event-time"
              label="Giờ đến hạn"
              required
              hint="Giờ Việt Nam (UTC+7)"
            >
              <Input
                type="time"
                step="1"
                value={draft.time}
                onChange={(e) => update('time', e.target.value)}
              />
            </FormField>
          </div>
          <FormField
            id="event-reminder"
            label="Nhắc trước (giờ)"
            error={errors.remindBefore}
            hint="Lưu thời gian nhắc trước cho sự kiện."
          >
            <Input
              type="number"
              min="0"
              max="2147483647"
              step="1"
              value={draft.remindBefore}
              onChange={(e) => update('remindBefore', e.target.value)}
            />
          </FormField>
          <FormField id="event-notes" label="Ghi chú" error={errors.notes}>
            <textarea
              className="calendar-textarea"
              rows={4}
              maxLength={1000}
              value={draft.notes}
              onChange={(e) => update('notes', e.target.value)}
            />
          </FormField>
        </fieldset>
        <div className="mt-1 flex justify-end gap-3 border-t border-line pt-3">
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" loading={busy}>
            ✓ Lưu
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function CalendarPage() {
  const { user, status } = useAuth();
  return (
    <StudentLayout activeKey="calendar">
      {status === 'authenticated' && user?.role === 'Student' && (
        <CalendarContent key={user.id} />
      )}
    </StudentLayout>
  );
}

export function CalendarContent() {
  const today = localDate(new Date());
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const range = useMemo(() => calendarRange(month), [month]);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    from: string;
    attempt: number;
    items?: CalendarEvent[];
    error?: string;
  } | null>(null);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<
    | { kind: 'create' }
    | { kind: 'edit' | 'delete'; event: CalendarEvent }
    | null
  >(null);
  const [detail, setDetail] = useState<{
    id: number;
    kind: 'edit' | 'delete';
  } | null>(null);
  const lifetime = useRef<AbortController | null>(null);
  const operation = useRef(false);
  const detailRequest = useRef(0);
  useEffect(() => {
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
    return () => {
      unsubscribe();
      controller.abort();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const sessionSignal = lifetime.current?.signal;
    const abort = () => controller.abort();
    sessionSignal?.addEventListener('abort', abort);
    api.listEvents(range.from, range.to, controller.signal).then(
      (items) => {
        if (!controller.signal.aborted)
          setResult({ from: range.from, attempt, items });
      },
      (err) => {
        if (!controller.signal.aborted)
          setResult({ from: range.from, attempt, error: eventError(err) });
      },
    );
    return () => {
      controller.abort();
      sessionSignal?.removeEventListener('abort', abort);
    };
  }, [range, attempt]);
  const current =
    result?.from === range.from && result.attempt === attempt ? result : null;
  const items = current?.items;
  const retry = () => {
    setActionError('');
    setAttempt((a) => a + 1);
  };
  const changed = (message: string) => {
    setModal(null);
    setNotice(message);
    retry();
  };
  const navigate = (delta: number) => {
    detailRequest.current += 1;
    const next = shiftMonth(month, delta);
    setMonth(next);
    setSelected(`${next}-01`);
    setNotice('');
    setActionError('');
    setDetail(null);
  };
  async function run(
    operationFn: (signal: AbortSignal) => Promise<unknown>,
    success: () => void,
  ) {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted || operation.current) return;
    operation.current = true;
    setBusy(true);
    setActionError('');
    try {
      await operationFn(signal);
      if (!signal.aborted) success();
    } catch (err) {
      if (!signal.aborted) setActionError(eventError(err));
    } finally {
      operation.current = false;
      if (!signal.aborted) setBusy(false);
    }
  }
  function open(event: CalendarEvent, kind: 'edit' | 'delete') {
    if (operation.current || modal) return;
    const requestId = ++detailRequest.current;
    setDetail({ id: event.id, kind });
    void run(
      async (signal) => {
        const fresh = await api.getEvent(event.id, signal);
        if (!signal.aborted && requestId === detailRequest.current)
          setModal({ kind, event: fresh });
      },
      () => setDetail(null),
    );
  }
  function card(event: CalendarEvent) {
    return (
      <article
        key={event.id}
        className={`calendar-event ${tones[event.status]}`}
      >
        <div className="flex items-start gap-2">
          <input
            className="mt-1 h-4 w-4 accent-brand"
            type="checkbox"
            checked={event.status === 'Completed'}
            disabled={busy || event.status === 'Completed'}
            aria-label={`Hoàn thành: ${event.title}`}
            onChange={() =>
              void run(
                (signal) => api.completeEvent(event.id, signal),
                () => changed('Đã hoàn thành sự kiện.'),
              )
            }
          />
          <h3 className="min-w-0 flex-1 break-words font-semibold">
            {event.title}
          </h3>
          <span className="calendar-status">{statusLabels[event.status]}</span>
        </div>
        <div className="ml-7 mt-3 grid gap-1 text-sm text-muted">
          <p className={event.status === 'Overdue' ? 'text-danger' : ''}>
            ◷ Hạn chót: {displayDate(event.dueDate)}
          </p>
          <p>♧ Nhắc trước {event.remindBefore} giờ</p>
          {event.notes && (
            <p className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-surface p-2 italic">
              {event.notes}
            </p>
          )}
        </div>
        <div className="mt-2 flex justify-end gap-3">
          <button
            className="text-xs text-brand hover:underline disabled:opacity-50"
            disabled={busy}
            onClick={() => open(event, 'edit')}
            aria-label={`Sửa: ${event.title}`}
          >
            Sửa
          </button>
          <button
            className="text-xs text-danger hover:underline disabled:opacity-50"
            disabled={busy}
            onClick={() => open(event, 'delete')}
            aria-label={`Xóa: ${event.title}`}
          >
            Xóa
          </button>
        </div>
      </article>
    );
  }
  const selectedItems =
    items?.filter((e) => localDate(e.dueDate) === selected) ?? [];
  return (
    <div className="calendar-page">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-brand">
            ▦ LỊCH BIỂU THÔNG MINH
          </p>
          <h1 className="font-medium text-navy">Lịch &amp; Deadline</h1>
          <p className="mt-1 text-sm text-secondary">
            Quản lý lịch thi, hạn nộp bài và ghi chú cá nhân.
          </p>
        </div>
        <Button
          disabled={busy}
          onClick={() => {
            if (operation.current) return;
            detailRequest.current += 1;
            setActionError('');
            setModal({ kind: 'create' });
          }}
        >
          ＋ Thêm sự kiện mới
        </Button>
      </div>
      <div
        className="mb-8 grid grid-cols-3 gap-6"
        aria-label="Thống kê trong khoảng lịch hiển thị"
      >
        {(['Upcoming', 'Overdue', 'Completed'] as const).map(
          (status, index) => (
            <div key={status} className={`calendar-stat ${tones[status]}`}>
              <div>
                <h2 className="text-xs font-medium uppercase text-muted">
                  {statusLabels[status]}
                </h2>
                <p className="mt-2 text-[32px] font-bold leading-8">
                  {items
                    ? String(
                        items.filter((e) => e.status === status).length,
                      ).padStart(2, '0')
                    : '—'}
                </p>
              </div>
              <span aria-hidden="true" className="calendar-stat-icon">
                {['◷', '⚠', '✓'][index]}
              </span>
            </div>
          ),
        )}
      </div>
      <p className="-mt-5 mb-6 text-xs text-muted">
        Thống kê và danh sách trong khoảng lịch hiển thị • Giờ Việt Nam
      </p>
      {notice && (
        <p role="status" className="mb-4 text-sm text-success">
          {notice}
        </p>
      )}
      {actionError && (
        <div className="mb-4">
          <ErrorState
            title="Không thể xử lý sự kiện"
            description={actionError}
            onRetry={
              detail
                ? () => {
                    const event = items?.find((e) => e.id === detail.id);
                    if (event) open(event, detail.kind);
                  }
                : retry
            }
          />
        </div>
      )}
      {busy && !modal && (
        <p role="status" className="mb-4 text-sm text-muted">
          Đang xử lý sự kiện…
        </p>
      )}
      <div className="calendar-columns">
        <section className="calendar-grid-card" aria-label="Lịch tháng">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-2xl font-semibold text-navy">
              Tháng {Number(month.slice(5))}, {month.slice(0, 4)}
            </h2>
            <div className="flex gap-1">
              <Button
                size="compact"
                variant="neutral"
                onClick={() => {
                  detailRequest.current += 1;
                  setDetail(null);
                  setMonth(today.slice(0, 7));
                  setSelected(today);
                }}
              >
                Hôm nay
              </Button>
              <Button
                size="icon"
                variant="neutral"
                aria-label="Tháng trước"
                onClick={() => navigate(-1)}
              >
                ‹
              </Button>
              <Button
                size="icon"
                variant="neutral"
                aria-label="Tháng sau"
                onClick={() => navigate(1)}
              >
                ›
              </Button>
            </div>
          </div>
          <div className="calendar-weekdays">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="calendar-days">
            {range.days.map((day) => (
              <button
                key={day}
                aria-label={`${day.split('-').reverse().join('/')}${items ? `, ${items.filter((e) => localDate(e.dueDate) === day).length} sự kiện` : ''}`}
                aria-pressed={selected === day}
                aria-current={day === today ? 'date' : undefined}
                className={`${day.startsWith(month) ? '' : 'calendar-adjacent'} ${day === selected ? 'calendar-selected' : ''}`}
                onClick={() => setSelected(day)}
              >
                <span>{Number(day.slice(-2))}</span>
                <span
                  className="flex justify-center gap-1"
                  aria-label={
                    items
                      ? `${items.filter((e) => localDate(e.dueDate) === day).length} sự kiện`
                      : undefined
                  }
                >
                  {(['Upcoming', 'Overdue', 'Completed'] as const)
                    .filter((s) =>
                      items?.some(
                        (e) => e.status === s && localDate(e.dueDate) === day,
                      ),
                    )
                    .map((s) => (
                      <i key={s} className={`calendar-dot ${tones[s]}`} />
                    ))}
                </span>
              </button>
            ))}
          </div>
          <div className="calendar-legend">
            {(['Upcoming', 'Overdue', 'Completed'] as const).map((s) => (
              <span key={s}>
                <i className={`calendar-dot ${tones[s]}`} />
                {statusLabels[s]}
              </span>
            ))}
            <span>
              <i className="h-3 w-3 rounded bg-cyan" />
              Ngày đang chọn
            </span>
          </div>
        </section>
        <section className="min-w-0" aria-label="Danh sách sự kiện">
          {!current ? (
            <LoadingState title="Đang tải lịch…" />
          ) : current.error ? (
            <ErrorState
              title="Không tải được lịch"
              description={current.error}
              onRetry={retry}
            />
          ) : !items?.length ? (
            <EmptyState
              className="calendar-empty"
              title="Bạn chưa có sự kiện nào"
              description="Chưa có sự kiện trong khoảng lịch này. Thêm lịch thi, hạn chót bài tập hoặc ghi chú cá nhân để quản lý tiến độ học tập hiệu quả hơn."
            >
              <Button
                disabled={busy}
                onClick={() => {
                  if (operation.current) return;
                  detailRequest.current += 1;
                  setModal({ kind: 'create' });
                }}
              >
                ＋ Thêm sự kiện mới
              </Button>
            </EmptyState>
          ) : (
            <>
              <h2 className="mb-3 text-2xl font-semibold text-navy">
                Sự kiện ngày {selected.split('-').reverse().join('/')}{' '}
                <span className="rounded-full bg-cyan px-2 py-1 align-middle text-xs">
                  {selectedItems.length} sự kiện
                </span>
              </h2>
              <div className="grid gap-3">
                {selectedItems.length ? (
                  selectedItems.map(card)
                ) : (
                  <p className="rounded-card bg-white p-6 text-sm text-muted">
                    Không có sự kiện trong ngày này.
                  </p>
                )}
              </div>
              <h2 className="mb-3 mt-8 text-2xl font-semibold text-navy">
                Sắp tới &amp; Các sự kiện khác
              </h2>
              <div className="grid gap-3">
                {items
                  .filter((e) => localDate(e.dueDate) !== selected)
                  .map(card)}
              </div>
            </>
          )}
        </section>
      </div>
      {modal?.kind === 'create' && lifetime.current && (
        <EventForm
          date={selected}
          signal={lifetime.current.signal}
          onClose={() => setModal(null)}
          onSaved={() => changed('Đã thêm sự kiện.')}
        />
      )}
      {modal?.kind === 'edit' && lifetime.current && (
        <EventForm
          original={modal.event}
          date={selected}
          signal={lifetime.current.signal}
          onClose={() => setModal(null)}
          onSaved={() => changed('Đã cập nhật sự kiện.')}
        />
      )}
      {modal?.kind === 'delete' && (
        <Dialog
          title="Xóa sự kiện này?"
          small
          busy={busy}
          onClose={() => {
            setModal(null);
            setActionError('');
          }}
        >
          <p className="text-sm leading-5 text-muted">
            Hành động này sẽ xóa vĩnh viễn sự kiện “{modal.event.title}” khỏi
            lịch cá nhân của bạn và không thể khôi phục.
          </p>
          <p className="my-4 rounded-lg border border-line bg-surface p-3 text-sm text-secondary">
            Hạn chót: {displayDate(modal.event.dueDate)}
          </p>
          {actionError && (
            <p role="alert" className="mb-4 text-sm text-danger">
              {actionError}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button
              variant="neutral"
              disabled={busy}
              onClick={() => {
                setModal(null);
                setActionError('');
              }}
            >
              Hủy
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                void run(
                  (signal) => api.deleteEvent(modal.event.id, signal),
                  () => changed('Đã xóa sự kiện.'),
                )
              }
            >
              Xóa
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
