import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { ApiError } from '../../lib/api';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/ui';
import { PublicLayout } from '../../layouts/PublicLayout';
import { StudentLayout } from '../../layouts/StudentLayout';
import { useAuth } from '../auth/AuthProvider';
import verifiedLogo from '../../assets/logo-student-40.svg';
import {
  formatOpportunityDate,
  type OpportunityDeadline,
  type OpportunityDetailResponse,
  type OpportunityType,
} from './contracts';
import { getOpportunityDetail } from './api';
import {
  buildOpportunityDetailSections,
  safeOpportunityReturnTo,
} from './detail-content';

type RequestState =
  | { status: 'loading' }
  | { status: 'error'; code: string }
  | { status: 'invalid-id' }
  | { status: 'success'; data: OpportunityDetailResponse };

const opportunityTypes: OpportunityType[] = [
  'Thực tập',
  'Việc làm',
  'Học bổng',
];
const requestTimeoutMs = 12_000;

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

function isValidOpportunityId(value: string): boolean {
  if (!/^[1-9]\d*$/.test(value)) return false;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0;
}

function getReturnTo(locationState: unknown): string {
  if (
    typeof locationState === 'object' &&
    locationState !== null &&
    'returnTo' in locationState
  ) {
    return safeOpportunityReturnTo(locationState.returnTo);
  }
  return '/opportunities';
}

function deadlineDisplay(deadline: OpportunityDeadline | null): {
  date: string;
  expired: boolean;
} | null {
  if (!deadline || deadline.precision === 'unknown' || !deadline.date) {
    return null;
  }
  return {
    date: formatOpportunityDate(deadline.date),
    expired: deadline.state === 'expired',
  };
}

function OpportunityTypeNavigation({
  activeType,
}: {
  activeType?: OpportunityType;
}) {
  return (
    <nav aria-label="Lọc Hub theo loại cơ hội">
      <ul className="inline-flex flex-wrap items-center gap-1 rounded-control border border-line bg-white p-1 shadow-soft">
        {opportunityTypes.map((type) => (
          <li key={type}>
            {type === activeType ? (
              <span
                aria-current="page"
                className="inline-flex min-h-9 items-center rounded-compact bg-brand px-3 type-caption font-semibold text-white"
              >
                {type}
              </span>
            ) : (
              <Link
                to={`/opportunities?type=${encodeURIComponent(type)}`}
                className="inline-flex min-h-9 items-center rounded-compact px-3 type-caption font-medium text-secondary transition-colors hover:bg-surface hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {type}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

function BackToHubLink({ to }: { to: string }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-10 items-center gap-2 rounded-sm type-label font-semibold text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <ArrowLeftIcon />
      Quay lại Hub cơ hội
    </Link>
  );
}

export function OpportunityDetailPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const [revision, setRevision] = useState(0);
  const [request, setRequest] = useState<RequestState>({ status: 'loading' });
  const returnTo = getReturnTo(location.state);
  const validId = isValidOpportunityId(id);

  useEffect(() => {
    if (!validId) {
      setRequest({ status: 'invalid-id' });
      return;
    }

    const controller = new AbortController();
    let active = true;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, requestTimeoutMs);

    setRequest({ status: 'loading' });
    getOpportunityDetail(id, controller.signal)
      .then((data) => {
        if (active) setRequest({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if (!active || (controller.signal.aborted && !timedOut)) return;
        setRequest({
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
  }, [id, revision, validId]);

  const activeType =
    request.status === 'success' ? request.data.item.type : undefined;
  const auth = useAuth();
  const isStudent =
    auth.status === 'authenticated' && auth.user?.role === 'Student';
  const Layout = isStudent ? StudentLayout : PublicLayout;

  return (
    <Layout activeKey="opportunities" variant="opportunities">
      <div className="mx-auto max-w-[1104px] pb-14">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <BackToHubLink to={returnTo} />
          <OpportunityTypeNavigation activeType={activeType} />
        </div>

        {request.status === 'loading' && (
          <>
            <h1 className="sr-only">Đang tải chi tiết cơ hội</h1>
            <LoadingState
              title="Đang tải chi tiết cơ hội"
              description="Thông tin sẽ xuất hiện khi dữ liệu sẵn sàng."
            />
          </>
        )}

        {request.status === 'invalid-id' && (
          <>
            <h1 className="sr-only">Đường dẫn cơ hội không hợp lệ</h1>
            <EmptyState
              title="Đường dẫn cơ hội không hợp lệ"
              description="Hãy quay lại Hub cơ hội để chọn một cơ hội công khai."
            >
              <ReturnButton to={returnTo} />
            </EmptyState>
          </>
        )}

        {request.status === 'error' && request.code === 'NOT_FOUND' && (
          <>
            <h1 className="sr-only">Không tìm thấy cơ hội</h1>
            <EmptyState
              title="Không tìm thấy cơ hội"
              description="Cơ hội này không tồn tại hoặc chưa được công khai."
            >
              <ReturnButton to={returnTo} />
            </EmptyState>
          </>
        )}

        {request.status === 'error' && request.code !== 'NOT_FOUND' && (
          <>
            <h1 className="sr-only">
              {request.code === 'TIMEOUT'
                ? 'Tải chi tiết mất quá nhiều thời gian'
                : 'Chưa thể tải chi tiết cơ hội'}
            </h1>
            <ErrorState
              title={
                request.code === 'TIMEOUT'
                  ? 'Tải chi tiết mất quá nhiều thời gian'
                  : 'Chưa thể tải chi tiết cơ hội'
              }
              description="Kết nối chưa phản hồi hoặc đã xảy ra lỗi. Bạn có thể thử lại."
              onRetry={() => setRevision((current) => current + 1)}
            />
          </>
        )}

        {request.status === 'success' && (
          <OpportunityDetail item={request.data.item} returnTo={returnTo} />
        )}
      </div>
    </Layout>
  );
}

function ReturnButton({ to }: { to: string }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-10 items-center justify-center rounded-control border border-brand bg-white px-4 py-2 text-sm font-medium leading-5 text-brand hover:bg-brand/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      Quay lại Hub cơ hội
    </Link>
  );
}

function OpportunityDetail({
  item,
  returnTo,
}: {
  item: OpportunityDetailResponse['item'];
  returnTo: string;
}) {
  const sections = buildOpportunityDetailSections({
    type: item.type,
    descriptionText: item.descriptionText,
    requirementsText: item.requirementsText,
    majors: item.majors,
    skills: item.skills,
    eligibleAcademicYears: item.eligibleAcademicYears,
  });

  return (
    <div className="grid min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] lg:gap-6">
      <div className="grid min-w-0 content-start gap-5">
        <OpportunityHeader item={item} returnTo={returnTo} />
        {sections.map((section) => (
          <Card key={section.title} className="p-5 sm:p-6">
            <h2 className="border-l-4 border-brand pl-3 type-heading text-navy">
              {section.title}
            </h2>
            {section.paragraphs.length > 0 && (
              <div className="mt-5 space-y-3 pl-4 type-body text-muted">
                {section.paragraphs.map((paragraph, index) => (
                  <p
                    key={`${section.title}-paragraph-${index}`}
                    className="whitespace-pre-line break-words"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            )}
            {(section.majors.length > 0 ||
              section.academicYears.length > 0) && (
              <div className="mt-5 grid gap-4 pl-1">
                {section.majors.length > 0 && (
                  <MetadataGroup label="Chuyên ngành áp dụng">
                    {section.majors.map((major) => (
                      <MetadataChip key={major.id}>{major.name}</MetadataChip>
                    ))}
                  </MetadataGroup>
                )}
                {section.academicYears.length > 0 && (
                  <MetadataGroup label="Năm học">
                    {section.academicYears.map((year) => (
                      <MetadataChip key={year}>Năm {year}</MetadataChip>
                    ))}
                  </MetadataGroup>
                )}
              </div>
            )}
            {section.skills.length > 0 && (
              <MetadataGroup label="Kỹ năng liên quan" className="mt-5 pl-1">
                {section.skills.map((skill) => (
                  <MetadataChip key={skill.id}>{skill.name}</MetadataChip>
                ))}
              </MetadataGroup>
            )}
          </Card>
        ))}
      </div>

      <aside className="grid min-w-0 content-start gap-4">
        <OpportunityFacts item={item} />
        {item.isVerified && <VerifiedInformation />}
      </aside>
    </div>
  );
}

function OpportunityHeader({
  item,
  returnTo,
}: {
  item: OpportunityDetailResponse['item'];
  returnTo: string;
}) {
  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <nav aria-label="Breadcrumb">
        <ol className="flex min-w-0 flex-wrap items-center gap-2 type-caption text-subtle">
          <li>Trang chủ</li>
          <li aria-hidden="true">/</li>
          <li>
            <Link to={returnTo} className="hover:text-brand hover:underline">
              Hub cơ hội
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li
            aria-current="page"
            className="min-w-0 break-words font-semibold text-secondary"
          >
            {item.title}
          </li>
        </ol>
      </nav>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant="info">{item.type}</Badge>
        {item.isVerified && <Badge variant="success">Verified</Badge>}
        {item.workFormat && (
          <Badge variant="neutral">Hình thức: {item.workFormat}</Badge>
        )}
      </div>

      <h1 className="mt-4 break-words text-[30px] font-bold leading-9 text-navy sm:text-[32px] sm:leading-10">
        {item.title}
      </h1>
      {item.publisher.trim() && (
        <p className="mt-3 flex min-w-0 items-start gap-2 type-label font-medium text-secondary">
          <BuildingIcon />
          <span className="break-words">{item.publisher}</span>
        </p>
      )}
    </Card>
  );
}

function OpportunityFacts({
  item,
}: {
  item: OpportunityDetailResponse['item'];
}) {
  const deadline = deadlineDisplay(item.deadline);
  const showLocation =
    item.workFormat !== 'Online' && Boolean(item.location?.trim());

  return (
    <Card className="min-w-0 p-5">
      <h2 className="type-title text-navy">Thông tin cơ hội</h2>
      <dl className="mt-4 grid gap-4 border-t border-line pt-4 type-label">
        <FactRow label="Loại cơ hội">{item.type}</FactRow>
        {item.publisher.trim() && (
          <FactRow label="Đơn vị đăng tin">{item.publisher}</FactRow>
        )}
        {item.workFormat && (
          <FactRow label="Hình thức làm việc">{item.workFormat}</FactRow>
        )}
        {showLocation && <FactRow label="Địa điểm">{item.location}</FactRow>}
        {deadline && (
          <FactRow label="Hạn nộp hồ sơ">
            <span className="inline-flex flex-wrap items-center justify-end gap-2 text-right">
              <span>{deadline.date}</span>
              {deadline.expired && <Badge variant="error">Đã hết hạn</Badge>}
            </span>
          </FactRow>
        )}
        {item.isVerified && (
          <FactRow label="Trạng thái xác minh">
            <Badge variant="success">Verified</Badge>
          </FactRow>
        )}
      </dl>

      {item.sourceUrl && (
        <div className="mt-4 border-t border-line pt-4">
          <h3 className="type-label font-medium text-muted">Nguồn tin gốc</h3>
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block break-all type-caption font-medium text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {item.sourceUrl}
          </a>
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-control bg-brand px-4 py-2 text-sm font-medium leading-5 text-white shadow-soft transition-colors hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Xem nguồn tin gốc
            <ExternalLinkIcon />
          </a>
        </div>
      )}
    </Card>
  );
}

function FactRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-start gap-3">
      <dt className="break-words text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-right font-semibold text-secondary">
        {children}
      </dd>
    </div>
  );
}

function VerifiedInformation() {
  return (
    <Card className="flex min-w-0 items-start gap-3 border-line bg-info-surface p-4">
      <img
        src={verifiedLogo}
        alt=""
        aria-hidden="true"
        className="h-10 w-10 shrink-0 rounded-control border border-line bg-white p-1"
      />
      <div className="min-w-0">
        <h2 className="type-label font-semibold text-navy">UniHub Verified</h2>
        <p className="mt-1 type-caption text-secondary">
          Cơ hội này được gắn nhãn Verified.
        </p>
      </div>
    </Card>
  );
}

function MetadataGroup({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid gap-2 ${className}`}>
      <h3 className="type-caption font-semibold uppercase tracking-wide text-subtle">
        {label}
      </h3>
      <ul className="flex flex-wrap gap-2" aria-label={label}>
        {children}
      </ul>
    </div>
  );
}

function MetadataChip({ children }: { children: ReactNode }) {
  return (
    <li className="inline-flex max-w-full items-center rounded-compact border border-line bg-surface px-3 py-1.5 type-caption font-medium text-secondary">
      <span className="break-words">{children}</span>
    </li>
  );
}

function BuildingIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="mt-0.5 h-4 w-4 shrink-0 text-brand"
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

function ArrowLeftIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <path
        d="M13 8H3m0 0 4-4m-4 4 4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <path
        d="M9 3h4v4M13 3 7 9m4-1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
