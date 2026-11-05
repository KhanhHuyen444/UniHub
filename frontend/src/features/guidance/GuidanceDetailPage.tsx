import { useCallback, useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { PublicLayout } from '../../layouts/PublicLayout';
import { StudentLayout } from '../../layouts/StudentLayout';
import { useAuth } from '../auth/AuthProvider';
import { Badge, Card, ErrorState, LoadingState } from '../../components/ui';
import { ApiError } from '../../lib/api';
import { getGuidanceDetail } from './api';
import { isGuidanceId } from './contracts';
import { useGuidanceRequest } from './useGuidanceRequest';
import { parseGuidanceContent } from './contentParser';

function ArrowLeftIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
      />
    </svg>
  );
}

function ArrowRightIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
      />
    </svg>
  );
}

function ListBulletIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm0 5.25h.007v.008H3.75V12Zm0 5.25h.007v.008H3.75v-.008Z"
      />
    </svg>
  );
}

function InformationCircleIcon({
  className = 'h-5 w-5',
}: {
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
      />
    </svg>
  );
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return isoString;
  }
}

function formatAcademicYears(years: number[]): string {
  if (!years || years.length === 0) return '';
  const sorted = [...years].sort((a, b) => a - b);
  if (sorted.length === 1) return `Năm ${sorted[0]}`;
  const isConsecutive = sorted.every(
    (val, idx) => idx === 0 || val === sorted[idx - 1] + 1,
  );
  if (isConsecutive && sorted.length > 1) {
    return `Năm ${sorted[0]} - Năm ${sorted[sorted.length - 1]}`;
  }
  return sorted.map((y) => `Năm ${y}`).join(', ');
}

export function GuidanceDetailPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const stateReturnTo: unknown = location.state?.returnTo;
  const returnTo =
    typeof stateReturnTo === 'string' &&
    /^\/roadmaps(?:\?[^#]*)?$/.test(stateReturnTo)
      ? stateReturnTo
      : '/roadmaps';
  const load = useCallback(
    async (signal: AbortSignal) => {
      if (!/^\d+$/.test(id) || !isGuidanceId(Number(id)))
        throw new ApiError('Mã bài định hướng không hợp lệ.', {
          code: 'INVALID_ID',
          kind: 'request',
          status: 400,
        });
      return getGuidanceDetail(Number(id), signal);
    },
    [id],
  );
  const { state, retry } = useGuidanceRequest(id, load);
  const item = state.status === 'success' ? state.data.item : null;
  const auth = useAuth();
  const isStudent =
    auth.status === 'authenticated' && auth.user?.role === 'Student';
  const Layout = isStudent ? StudentLayout : PublicLayout;

  const parsedContent = useMemo(() => {
    if (!item) return null;
    return parseGuidanceContent(item.descriptionText, item.requirementsText);
  }, [item]);

  return (
    <Layout activeKey="roadmaps">
      <div className="grid gap-6">
        <Link
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand w-fit"
          to={returnTo}
        >
          <ArrowLeftIcon className="h-4 w-4" />
          <span>Quay lại lộ trình</span>
        </Link>

        {state.status === 'loading' && (
          <LoadingState title="Đang tải bài định hướng" />
        )}

        {state.status === 'error' && (
          <ErrorState
            title={
              state.httpStatus === 404
                ? 'Không tìm thấy bài định hướng'
                : 'Không thể tải bài định hướng'
            }
            description={`Vui lòng thử lại.${state.httpStatus ? ` HTTP ${state.httpStatus}.` : ''} Mã lỗi: ${state.code}.`}
            onRetry={retry}
          />
        )}

        {item && parsedContent && (
          <div className="space-y-6">
            {/* Header: Academic Year Badge, Title, Lead */}
            <header className="space-y-3">
              {item.academicYears.length > 0 && (
                <div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-800">
                    {formatAcademicYears(item.academicYears)}
                  </span>
                </div>
              )}
              <h1 className="text-2xl md:text-3xl font-extrabold text-navy tracking-tight leading-snug break-words">
                {item.title}
              </h1>
              {parsedContent.summaryLead && (
                <p className="text-base text-slate-600 leading-relaxed max-w-4xl break-words">
                  {parsedContent.summaryLead}
                </p>
              )}
            </header>

            {/* 2-Column Responsive Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Main Content Column */}
              <main className="lg:col-span-8">
                <Card className="p-6 md:p-8 space-y-8 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
                  {parsedContent.sections.map((section) => {
                    const isNextStep =
                      section.title.toLowerCase().includes('bước tiếp theo') ||
                      section.id === 'buoc-tiep-theo';
                    const isSkillSection =
                      section.title.toLowerCase().includes('kỹ năng') ||
                      section.id === 'ky-nang-can-phat-trien';

                    return (
                      <section
                        key={section.id}
                        id={section.id}
                        className="scroll-mt-24 space-y-4 pt-2 first:pt-0"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-1.5 h-6 bg-brand rounded-full shrink-0" />
                          <h2 className="text-xl font-bold text-navy">
                            {section.title}
                          </h2>
                        </div>

                        {/* Paragraphs (skip lead paragraph in first section if already displayed in header) */}
                        <div className="space-y-3 text-slate-700 leading-relaxed text-sm md:text-base">
                          {section.paragraphs
                            .filter(
                              (p) =>
                                (!parsedContent.summaryLead ||
                                  p !== parsedContent.summaryLead) &&
                                !p.startsWith('Các hướng nghề nghiệp') &&
                                !p.startsWith('Các vị trí nghề nghiệp'),
                            )
                            .map((para, pIdx) => (
                              <p
                                key={pIdx}
                                className="whitespace-pre-wrap break-words"
                              >
                                {para}
                              </p>
                            ))}
                        </div>

                        {/* Career Roles (if present) */}
                        {section.careerRoles &&
                          section.careerRoles.length > 0 && (
                            <div className="space-y-3 pt-2">
                              <h3 className="font-bold text-slate-900 text-sm">
                                Các hướng nghề nghiệp phổ biến:
                              </h3>
                              <div className="space-y-3">
                                {section.careerRoles.map((role, rIdx) => (
                                  <div
                                    key={rIdx}
                                    className="text-sm leading-relaxed text-slate-700"
                                  >
                                    <span className="font-bold text-slate-900">
                                      {role.role}:
                                    </span>{' '}
                                    {role.description}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                        {/* Skill Pills (if in skill section) */}
                        {isSkillSection && item.skills.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-2">
                            {item.skills.map((skill) => (
                              <Badge
                                key={skill.id}
                                variant={
                                  skill.status === 'Closed'
                                    ? 'warning'
                                    : 'neutral'
                                }
                              >
                                {skill.name}
                                {skill.status === 'Closed' ? ' (Đã đóng)' : ''}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Phase Cards (e.g. Learning Phases) */}
                        {section.phaseCards &&
                          section.phaseCards.length > 0 && (
                            <div className="space-y-4 pt-2">
                              {section.phaseCards.map((card, cIdx) => (
                                <div
                                  key={cIdx}
                                  className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-5 space-y-3"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <h3 className="text-base font-bold text-navy">
                                      {card.title}
                                    </h3>
                                    {card.tag && (
                                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 shrink-0">
                                        {card.tag}
                                      </span>
                                    )}
                                  </div>
                                  {card.items.length > 0 && (
                                    <ul className="space-y-2 text-sm text-slate-600">
                                      {card.items.map((it, itIdx) => (
                                        <li
                                          key={itIdx}
                                          className="flex items-start gap-2.5"
                                        >
                                          <span className="text-slate-400 mt-0.5 shrink-0">
                                            •
                                          </span>
                                          <span className="break-words">
                                            {it}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                        {/* Bullet Items */}
                        {section.bulletItems &&
                          section.bulletItems.length > 0 && (
                            <ul className="space-y-2.5 text-sm md:text-base text-slate-700 pt-1">
                              {section.bulletItems.map((bullet, bIdx) => (
                                <li
                                  key={bIdx}
                                  className="flex items-start gap-2.5"
                                >
                                  <span className="text-brand font-bold shrink-0 mt-0.5">
                                    •
                                  </span>
                                  <span className="break-words">{bullet}</span>
                                </li>
                              ))}
                            </ul>
                          )}

                        {/* Call to action for next step */}
                        {isNextStep && (
                          <div className="pt-3">
                            <Link
                              to="/opportunities"
                              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-xl text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                            >
                              <span>Khám phá cơ hội phù hợp</span>
                              <ArrowRightIcon className="w-4 h-4" />
                            </Link>
                          </div>
                        )}
                      </section>
                    );
                  })}
                </Card>
              </main>

              {/* Sidebar Column */}
              <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
                {/* Table of Contents */}
                {parsedContent.sections.length > 1 && (
                  <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                    <div className="flex items-center gap-2.5 font-bold text-navy text-base">
                      <ListBulletIcon className="w-5 h-5 text-brand" />
                      <span>Nội dung chính</span>
                    </div>
                    <nav aria-label="Mục lục bài viết">
                      <ol className="space-y-2.5 text-sm text-slate-600">
                        {parsedContent.sections.map((sec, idx) => (
                          <li key={sec.id}>
                            <a
                              href={`#${sec.id}`}
                              className="hover:text-brand hover:underline transition block leading-snug"
                            >
                              {idx + 1}. {sec.title}
                            </a>
                          </li>
                        ))}
                      </ol>
                    </nav>
                  </Card>
                )}

                {/* Article Metadata */}
                <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
                  <div className="flex items-center gap-2.5 font-bold text-navy text-base">
                    <InformationCircleIcon className="w-5 h-5 text-brand" />
                    <span>Thông tin bài viết</span>
                  </div>

                  <div className="space-y-4 text-xs">
                    {/* Chuyên ngành */}
                    <div>
                      <span className="block font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                        CHUYÊN NGÀNH:
                      </span>
                      {item.majors.length === 0 ? (
                        <p className="text-slate-600 text-sm">
                          Chưa có thông tin
                        </p>
                      ) : (
                        <div className="text-slate-800 text-sm font-medium space-y-1">
                          {item.majors.map((major) => (
                            <div key={major.id}>
                              <Badge
                                variant={
                                  major.status === 'Closed'
                                    ? 'warning'
                                    : 'neutral'
                                }
                              >
                                {major.name}
                                {major.status === 'Closed' ? ' (Đã đóng)' : ''}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Năm học phù hợp */}
                    <div>
                      <span className="block font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                        NĂM HỌC PHÙ HỢP:
                      </span>
                      {item.academicYears.length === 0 ? (
                        <p className="text-slate-600 text-sm">
                          Bài viết chưa gắn năm học.
                        </p>
                      ) : (
                        <div className="text-slate-800 text-sm font-medium">
                          {item.academicYears.map((y) => `Năm ${y}`).join(', ')}
                        </div>
                      )}
                    </div>

                    {/* Kỹ năng liên quan */}
                    <div>
                      <span className="block font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                        KỸ NĂNG LIÊN QUAN:
                      </span>
                      {item.skills.length === 0 ? (
                        <p className="text-slate-600 text-sm">
                          Chưa có thông tin
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {item.skills.map((skill) => (
                            <Badge
                              key={skill.id}
                              variant={
                                skill.status === 'Closed'
                                  ? 'warning'
                                  : 'neutral'
                              }
                            >
                              {skill.name}
                              {skill.status === 'Closed' ? ' (Đã đóng)' : ''}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Đơn vị biên soạn */}
                    <div>
                      <span className="block font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                        ĐƠN VỊ BIÊN SOẠN:
                      </span>
                      <p className="text-slate-800 text-sm font-medium">
                        {item.publisher ?? 'Chưa có thông tin'}
                      </p>
                    </div>

                    {/* Ngày đăng */}
                    <div>
                      <span className="block font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                        NGÀY ĐĂNG:
                      </span>
                      <p className="text-slate-800 text-sm font-medium">
                        {formatDate(item.createdAt)}
                      </p>
                    </div>
                  </div>
                </Card>
              </aside>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
