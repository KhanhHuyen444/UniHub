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
import {
  buildOpportunityQuery,
  filtersFromSearch,
  formatOpportunityDate,
  hasOpportunityFilters,
  pageFromSearch,
  pageSizeFromSearch,
  type MajorOption,
  type OpportunityFilters,
  type OpportunityListResponse,
  type OpportunityDeadline,
  type PublicOpportunitySummary,
} from './contracts';
import { getMajorOptions, getOpportunityList } from './api';

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

function deadlineCopy(deadline: OpportunityDeadline | null): {
  date: string;
  state: 'open' | 'expired' | null;
} | null {
  if (!deadline || deadline.precision === 'unknown' || !deadline.date) {
    return null;
  }
  return {
    date: formatOpportunityDate(deadline.date),
    state: deadline.state,
  };
}

function OpportunityCard({
  item,
  returnTo,
}: {
  item: PublicOpportunitySummary;
  returnTo: string;
}) {
  const deadline = deadlineCopy(item.deadline);
  const details = [item.workFormat, item.location]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' · ');

  return (
    <Card className="p-6">
      <article aria-labelledby={`opportunity-${item.id}-title`}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">{item.type}</Badge>
          {item.isVerified && <Badge variant="success">Verified</Badge>}
        </div>
        <h2
          id={`opportunity-${item.id}-title`}
          className="mt-3 text-lg font-semibold leading-7 text-navy"
        >
          <Link
            to={`/opportunities/${item.id}`}
            state={{ returnTo }}
            className="rounded-sm hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            aria-label={`Xem chi tiết: ${item.title}`}
          >
            {item.title}
          </Link>
        </h2>
        {item.publisher.trim() && (
          <p className="mt-2 type-body text-secondary">{item.publisher}</p>
        )}
        {(details || deadline) && (
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 type-label text-muted">
            {details && <p>{details}</p>}
            {deadline && (
              <div className="flex flex-wrap items-center gap-2">
                <p>Hạn đến {deadline.date}</p>
                <Badge
                  variant={deadline.state === 'open' ? 'success' : 'error'}
                >
                  {deadline.state === 'open' ? 'Còn hạn' : 'Đã hết hạn'}
                </Badge>
              </div>
            )}
          </div>
        )}
      </article>
    </Card>
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

export function OpportunityHubPage() {
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

  return (
    <PublicLayout activeKey="opportunities">
      <div className="space-y-8">
        <header className="space-y-2">
          <h1 className="type-heading text-navy">Hub cơ hội</h1>
          <p className="type-body text-secondary">
            Tìm kiếm cơ hội thực tập, việc làm và học bổng.
          </p>
        </header>

        <Card className="p-6">
          <form onSubmit={submitSearch} noValidate>
            <div className="grid grid-cols-1 items-end gap-4 lg:grid-cols-4">
              <div className="grid gap-2">
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

              <FormField
                id="opportunity-major"
                label="Chuyên ngành"
                hint={
                  majorState.status === 'loading'
                    ? 'Đang tải lựa chọn.'
                    : majorState.status === 'error'
                      ? 'Tạm thời chưa thể tải danh sách chuyên ngành.'
                      : majorState.data.length === 0
                        ? 'Hiện chưa có chuyên ngành để chọn.'
                        : undefined
                }
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

              <FormField id="opportunity-type" label="Loại cơ hội">
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

              <FormField id="opportunity-work-format" label="Hình thức">
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

              <div className="flex flex-wrap justify-end gap-3 lg:col-span-4">
                {majorState.status === 'error' && (
                  <Button
                    variant="text"
                    onClick={() => setMajorRevision((value) => value + 1)}
                    className="px-2"
                  >
                    Thử lại chuyên ngành
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="min-w-[104px]"
                >
                  Xóa bộ lọc
                </Button>
                <Button type="submit" className="min-w-[125px]">
                  <SearchIcon />
                  Tìm kiếm
                </Button>
              </div>
            </div>
            {submitHint && (
              <p className="mt-3 type-caption text-danger" role="status">
                {submitHint}
              </p>
            )}
          </form>
        </Card>

        {listState.status === 'loading' && (
          <LoadingState
            title="Đang tải cơ hội"
            description="Danh sách sẽ xuất hiện khi dữ liệu sẵn sàng."
          />
        )}

        {listState.status === 'error' && listError && (
          <ErrorState
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
            response={listState.data}
            page={page}
            hasFilters={hasFilters}
            returnTo={returnTo}
            onPageChange={goToPage}
          />
        )}
      </div>
    </PublicLayout>
  );
}

function OpportunityResults({
  response,
  page,
  hasFilters,
  returnTo,
  onPageChange,
}: {
  response: OpportunityListResponse;
  page: number;
  hasFilters: boolean;
  returnTo: string;
  onPageChange: (page: number) => void;
}) {
  if (response.meta.total === 0) {
    return (
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
    );
  }

  if (page > response.meta.totalPages || response.items.length === 0) {
    return (
      <EmptyState
        title="Trang này chưa có cơ hội"
        description={`Có ${response.meta.total} kết quả. Hãy trở về trang cuối để tiếp tục xem danh sách.`}
      >
        <Button onClick={() => onPageChange(response.meta.totalPages)}>
          Về trang cuối
        </Button>
      </EmptyState>
    );
  }

  return (
    <section aria-labelledby="opportunity-results-title" className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="opportunity-results-title" className="type-title text-navy">
          {hasFilters ? 'Kết quả tìm kiếm' : 'Danh sách cơ hội'}
        </h2>
        <p className="type-label text-muted" aria-live="polite">
          {response.meta.total} cơ hội
        </p>
      </div>

      <ul className="space-y-4">
        {response.items.map((item) => (
          <li key={item.id}>
            <OpportunityCard item={item} returnTo={returnTo} />
          </li>
        ))}
      </ul>

      {response.meta.totalPages > 1 && (
        <nav
          aria-label="Phân trang danh sách cơ hội"
          className="flex flex-wrap items-center justify-center gap-4 pt-2"
        >
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Trang trước
          </Button>
          <p className="type-label text-secondary" aria-current="page">
            Trang {page} / {response.meta.totalPages}
          </p>
          <Button
            variant="outline"
            disabled={page >= response.meta.totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Trang sau
          </Button>
        </nav>
      )}
    </section>
  );
}
