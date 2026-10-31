import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { ApiError } from '../../lib/api';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  Select,
} from '../../components/ui';
import { PublicLayout } from '../../layouts/PublicLayout';
import { StudentLayout } from '../../layouts/StudentLayout';
import { useAuth } from '../auth/AuthProvider';
import {
  buildOpportunityQuery,
  filtersFromSearch,
  hasOpportunityFilters,
  pageFromSearch,
  pageSizeFromSearch,
  type MajorOption,
  type OpportunityFilters,
  type OpportunityListResponse,
  type OpportunityDeadline,
  type PublicOpportunityListItem,
} from './contracts';
import { getMajorOptions, getOpportunityList } from './api';
import arrowRightIcon from '../../assets/arrow-right.svg';
import { hubDeadlineLabel } from './hub-deadline';
import './opportunity-hub.css';

type RequestState<T> =
  | { status: 'loading' }
  | { status: 'error'; code: string }
  | { status: 'success'; data: T };

const requestTimeoutMs = 12_000;
const emptyFilters: OpportunityFilters = {
  q: '',
  majorId: '',
  type: '',
  workFormat: '',
};

function errorCode(error: unknown): string {
  if (error instanceof ApiError) return error.code;
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code;
  }
  return 'UNKNOWN_ERROR';
}

function listErrorCopy(code: string): { title: string; description: string } {
  if (code === 'INVALID_QUERY') {
    return {
      title: 'Thông tin tìm kiếm chưa hợp lệ',
      description: 'Hãy kiểm tra từ khóa và các bộ lọc rồi thử lại.',
    };
  }
  if (code === 'INVALID_FILTER') {
    return {
      title: 'Bộ lọc chuyên ngành không còn khả dụng',
      description: 'Hãy xóa bộ lọc này để xem các cơ hội phù hợp khác.',
    };
  }
  if (code === 'TIMEOUT') {
    return {
      title: 'Tải cơ hội mất quá nhiều thời gian',
      description: 'Kết nối chưa phản hồi. Bạn có thể thử tải lại.',
    };
  }
  return {
    title: 'Chưa thể tải danh sách cơ hội',
    description: 'Đã xảy ra lỗi khi kết nối. Vui lòng thử lại sau.',
  };
}

/** Deadline display với urgency indicator theo design V2 */
function DeadlineBadge({
  deadline,
  evaluatedAt,
}: {
  deadline: OpportunityDeadline;
  evaluatedAt: string;
}) {
  const label = hubDeadlineLabel(deadline, evaluatedAt);
  if (!label) return null;
  if (label.variant !== 'plain') {
    return (
      <Badge
        variant={label.variant}
        className="hub-deadline-badge rounded-control font-medium"
      >
        {label.text}
      </Badge>
    );
  }

  return <p className="type-caption text-secondary">{label.text}</p>;
}

function OpportunityCard({
  item,
  returnTo,
  evaluatedAt,
}: {
  item: PublicOpportunityListItem;
  returnTo: string;
  evaluatedAt: string;
}) {
  return (
    <Card className="p-5">
      <article
        aria-labelledby={`opportunity-${item.id}-title`}
        className="flex min-h-[247px] flex-col"
      >
        {/* Badges row */}
        <div className="flex min-h-5 flex-wrap items-center gap-2">
          <Badge variant="info" className="min-w-[72px] justify-center">
            {item.type}
          </Badge>
          {item.isVerified && (
            <Badge variant="success" className="min-w-[72px] justify-center">
              Verified
            </Badge>
          )}
        </div>

        {/* Title & publisher */}
        <div className="mt-3">
          <h2
            id={`opportunity-${item.id}-title`}
            className="text-base font-bold leading-6 text-ink line-clamp-2"
          >
            {item.title}
          </h2>
          {item.publisher.trim() && (
            <p className="mt-1 type-caption text-muted">{item.publisher}</p>
          )}
        </div>

        {/* Work format & location */}
        <div className="mt-3 grid gap-1.5 type-caption text-secondary">
          {item.workFormat && (
            <p className="flex items-center gap-2">
              <BuildingIcon />
              <span className="font-medium text-secondary">Hình thức:</span>
              <span>{item.workFormat}</span>
            </p>
          )}
          {item.skills.length > 0 && (
            <p className="flex min-w-0 items-start gap-2">
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="h-4 w-4 shrink-0 text-subtle"
                fill="none"
              >
                <path
                  d="m5 4-4 4 4 4m6-8 4 4-4 4M9 2 7 14"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="shrink-0 font-medium">Kỹ năng:</span>
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {item.skills.map((skill) => skill.name).join(', ')}
              </span>
            </p>
          )}
        </div>

        {/* Bottom: deadline + CTA */}
        <div className="mt-auto border-t border-line pt-3">
          {item.deadline && item.deadline.precision !== 'unknown' && (
            <div className="mb-3">
              <DeadlineBadge
                deadline={item.deadline}
                evaluatedAt={evaluatedAt}
              />
            </div>
          )}
          <div className="flex min-h-7 items-center justify-end">
            <Link
              to={`/opportunities/${item.id}`}
              state={{ returnTo }}
              aria-label={`Xem chi tiết: ${item.title}`}
              className="inline-flex min-h-7 items-center gap-1 rounded-sm type-caption font-semibold text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Xem chi tiết
              <ArrowRightIcon />
            </Link>
          </div>
        </div>
      </article>
    </Card>
  );
}

/* ─── Icons ─── */

function BuildingIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-4 w-4 shrink-0 text-subtle"
      fill="none"
    >
      <path
        d="M3 14.5V2.5h8v12M11 6.5h2v8M1.5 14.5h13"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.5 5h1M8.5 5h1M5.5 8h1M8.5 8h1M5.5 11h1M8.5 11h1"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <img
      src={arrowRightIcon}
      alt=""
      aria-hidden="true"
      className="h-[14px] w-[14px]"
    />
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <circle
        cx="6.8"
        cy="6.8"
        r="4.7"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="m10.4 10.4 3.2 3.2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
    >
      <path
        d="M5.5 4V2.75h5V4M2.25 5.25h11.5v8H2.25zM2.25 8.25h11.5M6.5 8.25v1.5h3v-1.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <path
        d="M12 4 4 12M4 4l8 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ─── Main page ─── */

export function OpportunityHubPage() {
  useEffect(() => {
    document.body.classList.add('opportunity-hub-page');
    return () => document.body.classList.remove('opportunity-hub-page');
  }, []);
  const routerLocation = useLocation();
  const [, setSearchParams] = useSearchParams();
  const [draft, setDraft] = useState<OpportunityFilters>(emptyFilters);
  const [submitHint, setSubmitHint] = useState('');
  const [listRevision, setListRevision] = useState(0);
  const [majorRevision, setMajorRevision] = useState(0);
  const [listState, setListState] = useState<
    RequestState<OpportunityListResponse>
  >({ status: 'loading' });
  const [majorState, setMajorState] = useState<RequestState<MajorOption[]>>({
    status: 'loading',
  });

  useEffect(() => {
    setDraft(filtersFromSearch(routerLocation.search));
    setSubmitHint('');
  }, [routerLocation.search]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, requestTimeoutMs);
    const query = new URLSearchParams(
      routerLocation.search.startsWith('?')
        ? routerLocation.search.slice(1)
        : routerLocation.search,
    );

    setListState({ status: 'loading' });
    getOpportunityList(query, controller.signal)
      .then((data) => {
        if (active) setListState({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (controller.signal.aborted && !timedOut) return;
        setListState({
          status: 'error',
          code: timedOut ? 'TIMEOUT' : errorCode(error),
        });
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [routerLocation.search, listRevision]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, requestTimeoutMs);

    setMajorState({ status: 'loading' });
    getMajorOptions(controller.signal)
      .then((data) => {
        if (active) setMajorState({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if (!active || (controller.signal.aborted && !timedOut)) return;
        setMajorState({
          status: 'error',
          code: timedOut ? 'TIMEOUT' : errorCode(error),
        });
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [majorRevision]);

  const returnTo = `${routerLocation.pathname}${routerLocation.search}`;
  const appliedFilters = filtersFromSearch(routerLocation.search);
  const hasFilters = hasOpportunityFilters(routerLocation.search);
  const page = pageFromSearch(routerLocation.search);
  const pageSize = pageSizeFromSearch(routerLocation.search);
  const availableMajorIds = useMemo(
    () =>
      majorState.status === 'success'
        ? new Set(majorState.data.map((major) => String(major.id)))
        : new Set<string>(),
    [majorState],
  );
  const selectedMajorName =
    majorState.status === 'success'
      ? majorState.data.find(
          (major) => String(major.id) === appliedFilters.majorId,
        )?.name
      : undefined;

  function updateDraft(key: keyof OpportunityFilters, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSubmitHint('');
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !draft.q.trim() &&
      !draft.majorId.trim() &&
      !draft.type &&
      !draft.workFormat
    ) {
      setSubmitHint('Nhập từ khóa hoặc chọn ít nhất một bộ lọc để tìm kiếm.');
      return;
    }
    setSubmitHint('');
    setSearchParams(buildOpportunityQuery(draft, { page: 1, pageSize }));
  }

  function clearFilters() {
    setSubmitHint('');
    setDraft(emptyFilters);
    setSearchParams(buildOpportunityQuery(emptyFilters, { page: 1, pageSize }));
  }

  function clearClosedMajorFilter() {
    const next = new URLSearchParams(routerLocation.search);
    next.delete('majorId');
    next.delete('page');
    setSearchParams(next);
  }

  function goToPage(nextPage: number) {
    const next = new URLSearchParams(routerLocation.search);
    if (nextPage <= 1) next.delete('page');
    else next.set('page', String(nextPage));
    setSearchParams(next);
  }

  const listError =
    listState.status === 'error' ? listErrorCopy(listState.code) : null;
  const isClosedMajorError =
    listState.status === 'error' &&
    listState.code === 'INVALID_FILTER' &&
    new URLSearchParams(routerLocation.search).has('majorId');
  const majorStatusMessage =
    majorState.status === 'error'
      ? 'Không tải được danh sách chuyên ngành.'
      : majorState.status === 'success' && majorState.data.length === 0
        ? 'Hiện chưa có chuyên ngành để chọn.'
        : '';

  const auth = useAuth();
  const isStudent =
    auth.status === 'authenticated' && auth.user?.role === 'Student';

  const pageContent = (
    <div className="pb-[58px]">
      {/* ── Hero header ── */}
      <header className="pb-2 pt-1">
        <Badge
          variant="info"
          className="inline-flex h-[26px] min-h-[26px] items-center gap-1 whitespace-nowrap bg-cyan px-3 text-navy"
        >
          <BriefcaseIcon />
          Cổng thông tin tuyển dụng &amp; học bổng
        </Badge>
        <h1 className="mt-3 type-display text-ink">Khám phá Cơ hội</h1>
        <p className="mt-2 max-w-[672px] type-body text-secondary">
          Hàng trăm cơ hội thực tập, việc làm và học bổng uy tín dành riêng cho
          sinh viên Việt Nam, cập nhật liên tục mỗi ngày.
        </p>
      </header>

      {/* ── Filter card ── */}
      <Card className="mt-6 px-6 pb-6 pt-5">
        <form onSubmit={submitSearch} noValidate>
          {/* 4-column filter row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Keyword */}
            <div className="grid gap-1.5">
              <label
                htmlFor="opportunity-query"
                className="type-label font-medium text-secondary"
              >
                Từ khóa
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-subtle">
                  <SearchIcon />
                </span>
                <Input
                  id="opportunity-query"
                  value={draft.q}
                  onChange={(event) =>
                    updateDraft('q', event.currentTarget.value)
                  }
                  placeholder="Nhập tiêu đề, đơn vị đăng hoặc kỹ năng..."
                  autoComplete="off"
                  className="pl-9"
                />
              </div>
            </div>

            {/* Major */}
            <FormField
              id="opportunity-major"
              label="Chuyên ngành"
              className="gap-1.5"
            >
              <Select
                value={draft.majorId}
                disabled={
                  majorState.status !== 'success' ||
                  majorState.data.length === 0
                }
                onChange={(event) =>
                  updateDraft('majorId', event.currentTarget.value)
                }
              >
                <option value="">
                  {majorState.status === 'error'
                    ? 'Chuyên ngành chưa khả dụng'
                    : majorState.status === 'loading'
                      ? 'Đang tải chuyên ngành...'
                      : majorState.data.length === 0
                        ? 'Chưa có chuyên ngành'
                        : 'Tất cả chuyên ngành'}
                </option>
                {draft.majorId && !availableMajorIds.has(draft.majorId) && (
                  <option value={draft.majorId} disabled>
                    Chuyên ngành đã chọn không còn khả dụng
                  </option>
                )}
                {majorState.status === 'success' &&
                  majorState.data.map((major) => (
                    <option key={major.id} value={String(major.id)}>
                      {major.name}
                    </option>
                  ))}
              </Select>
            </FormField>

            {/* Type */}
            <FormField
              id="opportunity-type"
              label="Loại cơ hội"
              className="gap-1.5"
            >
              <Select
                value={draft.type}
                onChange={(event) =>
                  updateDraft('type', event.currentTarget.value)
                }
              >
                <option value="">Tất cả loại cơ hội</option>
                <option value="Thực tập">Thực tập</option>
                <option value="Việc làm">Việc làm</option>
                <option value="Học bổng">Học bổng</option>
              </Select>
            </FormField>

            {/* Work format */}
            <FormField
              id="opportunity-work-format"
              label="Hình thức làm việc"
              className="gap-1.5"
            >
              <Select
                value={draft.workFormat}
                onChange={(event) =>
                  updateDraft('workFormat', event.currentTarget.value)
                }
              >
                <option value="">Tất cả hình thức</option>
                <option value="Online">Online</option>
                <option value="Offline">Offline</option>
                <option value="Hybrid">Hybrid</option>
              </Select>
            </FormField>
          </div>

          {/* Action row */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {(submitHint || majorStatusMessage) && (
                <p className="type-caption text-danger" role="status">
                  {submitHint || majorStatusMessage}
                </p>
              )}
              {majorState.status === 'error' && (
                <Button
                  variant="text"
                  onClick={() => setMajorRevision((value) => value + 1)}
                  className="shrink-0 px-2"
                >
                  Thử lại
                </Button>
              )}
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-3">
              <Button
                variant="outline"
                onClick={clearFilters}
                className="min-w-[120px] gap-1.5"
              >
                <XIcon />
                Xóa bộ lọc
              </Button>
              <Button
                type="submit"
                className="min-w-[125px] gap-2 shadow-button"
              >
                <SearchIcon />
                Tìm kiếm
              </Button>
            </div>
          </div>
        </form>
      </Card>

      {/* ── List states ── */}
      {listState.status === 'loading' && (
        <LoadingState
          className="mt-8"
          title="Đang tải cơ hội"
          description="Danh sách sẽ xuất hiện khi dữ liệu sẵn sàng."
        />
      )}

      {listState.status === 'error' && listError && (
        <ErrorState
          className="mt-8"
          title={listError.title}
          description={listError.description}
          onRetry={() => setListRevision((value) => value + 1)}
        >
          {isClosedMajorError && (
            <Button variant="outline" onClick={clearClosedMajorFilter}>
              Xóa bộ lọc chuyên ngành
            </Button>
          )}
        </ErrorState>
      )}

      {listState.status === 'success' && (
        <OpportunityResults
          className="mt-8"
          response={listState.data}
          page={page}
          hasFilters={hasFilters}
          filters={appliedFilters}
          selectedMajorName={selectedMajorName}
          returnTo={returnTo}
          onPageChange={goToPage}
        />
      )}
    </div>
  );

  if (isStudent) {
    return (
      <StudentLayout activeKey="opportunities" variant="opportunities">
        {pageContent}
      </StudentLayout>
    );
  }

  return (
    <PublicLayout activeKey="opportunities" variant="opportunities">
      {pageContent}
    </PublicLayout>
  );
}

/* ─── Results section ─── */

function OpportunityResults({
  className,
  response,
  page,
  hasFilters,
  filters,
  selectedMajorName,
  returnTo,
  onPageChange,
}: {
  className: string;
  response: OpportunityListResponse;
  page: number;
  hasFilters: boolean;
  filters: OpportunityFilters;
  selectedMajorName?: string;
  returnTo: string;
  onPageChange: (page: number) => void;
}) {
  if (response.meta.total === 0) {
    return (
      <div className={className}>
        <EmptyState
          title={
            hasFilters
              ? 'Không tìm thấy cơ hội phù hợp'
              : 'Hiện chưa có cơ hội nào được công bố'
          }
          description={
            hasFilters
              ? 'Hãy thử thay đổi từ khóa hoặc bộ lọc.'
              : 'Các cơ hội sẽ xuất hiện tại đây khi được công bố.'
          }
        />
      </div>
    );
  }

  if (page > response.meta.totalPages || response.items.length === 0) {
    return (
      <div className={className}>
        <EmptyState
          title="Trang này chưa có cơ hội"
          description={`Có ${response.meta.total} kết quả. Hãy trở về trang cuối để tiếp tục xem danh sách.`}
        >
          <Button onClick={() => onPageChange(response.meta.totalPages)}>
            Về trang cuối
          </Button>
        </EmptyState>
      </div>
    );
  }

  // Build human-readable result summary
  const summaryFilters = [
    filters.type ? filters.type.toLocaleLowerCase('vi-VN') : '',
    selectedMajorName ?? '',
  ].filter(Boolean);
  const summarySuffix = summaryFilters.length
    ? ` ${summaryFilters.join(' ')} phù hợp`
    : ' phù hợp';
  const visiblePages = pageWindow(page, response.meta.totalPages);
  const evaluatedAt = response.meta.evaluatedAt;

  return (
    <section className={className} aria-label="Kết quả cơ hội">
      {/* Result count summary */}
      <p className="min-h-[35.5px] type-body text-secondary" aria-live="polite">
        Tìm thấy{' '}
        <strong className="mx-1 font-bold text-brand">
          {response.meta.total}
        </strong>{' '}
        cơ hội{summarySuffix}
      </p>

      {/* Grid of cards */}
      <ul className="mt-4 grid list-none grid-cols-1 items-start gap-x-6 gap-y-5 p-0 md:grid-cols-2 xl:grid-cols-3">
        {response.items.map((item) => (
          <li key={item.id}>
            <OpportunityCard
              item={item}
              returnTo={returnTo}
              evaluatedAt={evaluatedAt}
            />
          </li>
        ))}
      </ul>

      {/* Pagination */}
      {response.meta.totalPages > 1 && (
        <nav
          aria-label="Phân trang danh sách cơ hội"
          className="mt-8 flex flex-wrap items-center justify-center gap-1.5"
        >
          <Button
            variant="outline"
            size="compact"
            className="min-w-[83px] whitespace-nowrap border-control bg-white px-3 text-secondary disabled:border-control disabled:bg-white disabled:text-muted"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Trang trước"
          >
            &lt; Trước
          </Button>
          {visiblePages.map((pageNumber) => (
            <Button
              key={pageNumber}
              variant={pageNumber === page ? 'primary' : 'outline'}
              size="page"
              aria-current={pageNumber === page ? 'page' : undefined}
              aria-label={`Trang ${pageNumber}`}
              onClick={() => onPageChange(pageNumber)}
              className={
                pageNumber !== page
                  ? 'border-control bg-white text-secondary hover:bg-brand/5'
                  : ''
              }
            >
              {pageNumber}
            </Button>
          ))}
          <Button
            variant="outline"
            size="compact"
            className="min-w-[73px] whitespace-nowrap border-control bg-white px-3 text-secondary disabled:border-control disabled:bg-white disabled:text-muted"
            disabled={page >= response.meta.totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Trang tiếp"
          >
            Tiếp &gt;
          </Button>
        </nav>
      )}
    </section>
  );
}

function pageWindow(currentPage: number, totalPages: number): number[] {
  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}
