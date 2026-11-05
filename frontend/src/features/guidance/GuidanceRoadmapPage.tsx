import { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PublicLayout } from '../../layouts/PublicLayout';
import { StudentLayout } from '../../layouts/StudentLayout';
import { useAuth } from '../auth/AuthProvider';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Select,
} from '../../components/ui';
import { ApiError } from '../../lib/api';
import { getMajorOptions } from '../opportunities/api';
import { getGuidanceList } from './api';
import { isGuidanceId } from './contracts';
import { useGuidanceRequest } from './useGuidanceRequest';

function majorFromSearch(search: string): number | undefined {
  const query = new URLSearchParams(search);
  const values = query.getAll('majorId');
  if (
    [...query.keys()].some((key) => key !== 'majorId') ||
    values.length > 1 ||
    (values.length === 1 &&
      (!/^\d+$/.test(values[0]) || !isGuidanceId(Number(values[0]))))
  ) {
    throw new ApiError('Tham số chuyên ngành không hợp lệ.', {
      code: 'INVALID_QUERY',
      kind: 'request',
      status: 400,
    });
  }
  return values.length ? Number(values[0]) : undefined;
}

const STAGE_META: Record<
  number,
  {
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    icon: string;
    phaseTitle: string;
    phaseDesc: string;
  }
> = {
  1: {
    badgeBg: 'bg-blue-50',
    badgeText: 'text-[#0077B6]',
    badgeBorder: 'border-blue-200',
    icon: '🌱',
    phaseTitle: 'Khởi đầu & Nền tảng tư duy',
    phaseDesc:
      'Nhập môn chuyên ngành, rèn luyện tư duy logic và công cụ cơ sở.',
  },
  2: {
    badgeBg: 'bg-teal-50',
    badgeText: 'text-[#0D9488]',
    badgeBorder: 'border-teal-200',
    icon: '⚡',
    phaseTitle: 'Tăng tốc & Kỹ năng chuyên sâu',
    phaseDesc:
      'Đi sâu công nghệ cốt lõi, kiến trúc hệ thống và quy trình làm việc nhóm.',
  },
  3: {
    badgeBg: 'bg-sky-50',
    badgeText: 'text-[#0284C7]',
    badgeBorder: 'border-sky-200',
    icon: '💼',
    phaseTitle: 'Thực chiến & Dự án ứng dụng',
    phaseDesc:
      'Hoàn thiện dự án thực tế, tiếp cận framework nâng cao và chuẩn bị thực tập.',
  },
  4: {
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-[#1E3A8A]',
    badgeBorder: 'border-indigo-200',
    icon: '🎓',
    phaseTitle: 'Tốt nghiệp & Chuyển giao công việc',
    phaseDesc:
      'Hoàn thiện đồ án tốt nghiệp, đóng gói portfolio và phỏng vấn doanh nghiệp.',
  },
};

export function GuidanceRoadmapPage() {
  const [params, setParams] = useSearchParams();
  const search = params.toString();
  const auth = useAuth();
  const isStudent =
    auth.status === 'authenticated' && auth.user?.role === 'Student';
  const Layout = isStudent ? StudentLayout : PublicLayout;

  const authIdentity =
    auth.status === 'authenticated' && auth.user
      ? `${auth.user.id}:${auth.user.role}`
      : auth.status;
  const isRestoring = auth.status === 'restoring';

  const load = useCallback(
    (signal: AbortSignal) => {
      if (isRestoring) {
        return new Promise<never>((_, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason));
        });
      }
      return getGuidanceList({ majorId: majorFromSearch(search), signal });
    },
    [search, isRestoring],
  );
  // The loader can reject synchronously when the URL is invalid.
  const safeLoad = useCallback(
    async (signal: AbortSignal) => load(signal),
    [load],
  );
  const roadmap = useGuidanceRequest(`${search}::${authIdentity}`, safeLoad);
  const majors = useGuidanceRequest('major-options', getMajorOptions);
  const rawMajor = params.get('majorId');
  const requestedMajor =
    rawMajor !== null &&
    /^\d+$/.test(rawMajor) &&
    isGuidanceId(Number(rawMajor))
      ? String(Number(rawMajor))
      : rawMajor;
  const selectedId =
    requestedMajor ??
    (roadmap.state.status === 'success'
      ? String(roadmap.state.data.selectedMajor?.id ?? '')
      : '');
  const options = majors.state.status === 'success' ? majors.state.data : [];
  const unavailable =
    selectedId !== '' &&
    !options.some((major) => String(major.id) === selectedId);
  const returnTo = `/roadmaps${search ? `?${search}` : ''}`;

  return (
    <Layout activeKey="roadmaps">
      <div className="grid gap-8 pb-12">
        {/* 1. HERO BANNER */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#CAF0F8]/50 via-[#E0F2FE]/30 to-white p-6 sm:p-8 border border-sky-100/80 shadow-soft">
          <div className="relative z-10">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand/10 border border-brand/20 px-3.5 py-1 text-xs font-bold tracking-wide text-brand mb-3 shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-brand animate-pulse" />
              LỘ TRÌNH KỸ NĂNG &amp; NGHỀ NGHIỆP
            </span>
            <h1 className="type-heading text-2xl sm:text-3xl font-extrabold text-navy tracking-tight">
              Lộ trình kỹ năng &amp; Định hướng
            </h1>
            <p className="mt-2 text-sm sm:text-base leading-relaxed text-secondary max-w-2xl">
              Hệ thống định hướng 4 năm học được chuẩn hóa theo từng chuyên
              ngành, giúp bạn nắm vững tư duy nhập môn, làm chủ kỹ năng cốt lõi
              và tự tin sẵn sàng cho sự nghiệp.
            </p>

            {/* 4 Stage Stepper Pills */}
            <div className="mt-6 flex flex-wrap items-center gap-2.5 pt-4 border-t border-brand/10 text-xs font-semibold">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 border border-blue-200/90 px-3 py-1.5 text-[#0077B6] shadow-2xs">
                <span>🌱</span> Năm 1: Khởi đầu
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 border border-teal-200/90 px-3 py-1.5 text-[#0D9488] shadow-2xs">
                <span>⚡</span> Năm 2: Tăng tốc
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 border border-sky-200/90 px-3 py-1.5 text-[#0284C7] shadow-2xs">
                <span>💼</span> Năm 3: Thực chiến
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 border border-indigo-200/90 px-3 py-1.5 text-[#1E3A8A] shadow-2xs">
                <span>🎓</span> Năm 4: Tốt nghiệp
              </span>
            </div>
          </div>
        </div>

        {/* 2. FILTER CARD */}
        <div className="rounded-card border border-line bg-white p-5 sm:p-6 shadow-soft">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-info-surface text-brand shadow-2xs">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <div>
                <label
                  htmlFor="guidance-major"
                  className="type-label font-bold text-ink cursor-pointer block"
                >
                  Chuyên ngành
                </label>
                <p className="text-xs text-muted">
                  Chọn chuyên ngành để xem chi tiết lộ trình học tập và kỹ năng
                  cần trang bị
                </p>
              </div>
            </div>
            {options.length > 0 && (
              <span className="self-start sm:self-center inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                <span>📚</span> {options.length} chuyên ngành
              </span>
            )}
          </div>

          <Select
            id="guidance-major"
            value={selectedId}
            disabled={majors.state.status !== 'success' || options.length === 0}
            onChange={(event) => {
              const next = new URLSearchParams(params);
              if (event.target.value) next.set('majorId', event.target.value);
              else next.delete('majorId');
              setParams(next);
            }}
            className="w-full text-sm font-medium border-line rounded-control cursor-pointer"
          >
            <option value="">Chuyên ngành mặc định</option>
            {unavailable && (
              <option value={selectedId} disabled>
                Chuyên ngành đã chọn không có trong danh sách Active
              </option>
            )}
            {options.map((major) => (
              <option key={major.id} value={major.id}>
                {major.name}
              </option>
            ))}
          </Select>
          {majors.state.status === 'loading' && (
            <LoadingState title="Đang tải chuyên ngành" />
          )}
          {majors.state.status === 'error' && (
            <ErrorState
              title="Không thể tải chuyên ngành"
              description="Danh sách lựa chọn chưa tải được. Vui lòng thử lại."
              onRetry={majors.retry}
            />
          )}
          {majors.state.status === 'success' && options.length === 0 && (
            <p className="type-label text-muted">
              Chưa có chuyên ngành Active để lựa chọn.
            </p>
          )}
        </div>

        {roadmap.state.status === 'loading' && (
          <LoadingState title="Đang tải lộ trình" />
        )}
        {roadmap.state.status === 'error' && (
          <ErrorState
            title={
              roadmap.state.code === 'INVALID_FILTER'
                ? 'Chuyên ngành không còn khả dụng'
                : 'Không thể tải dữ liệu lộ trình'
            }
            description={`Vui lòng thử lại.${roadmap.state.httpStatus ? ` HTTP ${roadmap.state.httpStatus}.` : ''} Mã lỗi: ${roadmap.state.code}.`}
            onRetry={roadmap.retry}
          >
            {search && (
              <Button variant="outline" onClick={() => setParams({})}>
                Xóa lựa chọn
              </Button>
            )}
          </ErrorState>
        )}
        {roadmap.state.status === 'success' &&
          (roadmap.state.data.selectedMajor === null ? (
            <EmptyState
              title="Chưa có chuyên ngành khả dụng"
              description="Chưa có chuyên ngành Active để hiển thị lộ trình."
            />
          ) : roadmap.state.data.stages.length === 0 ? (
            <EmptyState
              title="Lộ trình cho chuyên ngành này đang được biên soạn"
              description="Bạn có thể chọn chuyên ngành khác."
            />
          ) : (
            <div className="grid gap-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line/80 pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-xs font-bold uppercase tracking-wider text-muted">
                      Lộ trình đào tạo chuẩn
                    </span>
                  </div>
                  <h2 className="type-title text-xl sm:text-2xl font-bold text-navy">
                    {roadmap.state.data.selectedMajor.name}
                  </h2>
                </div>
                <div className="inline-flex items-center gap-2 rounded-xl bg-info-surface/80 border border-brand/20 px-3.5 py-1.5 text-xs font-semibold text-brand">
                  <span>🎯</span> {roadmap.state.data.stages.length} giai đoạn
                  năm học
                </div>
              </div>

              <div className="space-y-6">
                {roadmap.state.data.stages.map((stage) => {
                  const meta = STAGE_META[stage.academicYear] || {
                    badgeBg: 'bg-blue-50',
                    badgeText: 'text-[#0077B6]',
                    badgeBorder: 'border-blue-200',
                    icon: '📌',
                    phaseTitle: 'Giai đoạn học tập',
                    phaseDesc: 'Học phần và kỹ năng trọng tâm theo năm học.',
                  };

                  return (
                    <Card
                      key={stage.academicYear}
                      className="overflow-hidden border border-line bg-white p-5 sm:p-6 shadow-soft hover:shadow-md transition-shadow"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 pb-3.5 mb-5">
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-10 w-10 items-center justify-center rounded-xl ${meta.badgeBg} border ${meta.badgeBorder} text-lg shadow-2xs`}
                          >
                            {meta.icon}
                          </span>
                          <div>
                            <h2 className="type-title text-base sm:text-lg font-bold text-navy">
                              Năm {stage.academicYear}
                            </h2>
                            <p className="text-xs text-muted font-medium">
                              {meta.phaseTitle} · {meta.phaseDesc}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full ${meta.badgeBg} border ${meta.badgeBorder} px-3 py-1 text-xs font-bold ${meta.badgeText}`}
                        >
                          Chặng {stage.academicYear}/4
                        </span>
                      </div>

                      <ul className="grid gap-3 sm:gap-4">
                        {stage.items.map((item) => (
                          <li
                            key={item.id}
                            className="group/item rounded-xl border border-line/80 bg-slate-50/60 p-4 sm:p-5 hover:bg-white hover:border-brand/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                              <div className="space-y-2 min-w-0 flex-1">
                                <Link
                                  className="type-title text-sm sm:text-base font-bold text-ink group-hover/item:text-brand transition-colors block leading-snug line-clamp-2"
                                  to={`/roadmaps/${item.id}`}
                                  state={{ returnTo }}
                                >
                                  {item.title}
                                </Link>

                                {item.requiredSkills.length > 0 && (
                                  <div className="pt-0.5">
                                    <span className="text-[11px] font-semibold text-subtle block mb-1">
                                      Kỹ năng trọng tâm:
                                    </span>
                                    <ul
                                      aria-label={`Kỹ năng yêu cầu: ${item.title}`}
                                      className="flex flex-wrap gap-1.5"
                                    >
                                      {item.requiredSkills.map((skill) => (
                                        <li key={skill.id}>
                                          <Badge
                                            variant="info"
                                            className="bg-white border border-brand/20 text-brand text-[11px] px-2.5 py-0.5 shadow-2xs hover:bg-info-surface transition-colors"
                                          >
                                            #{skill.name}
                                          </Badge>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>

                              <div className="shrink-0 sm:self-center flex items-center gap-1 text-xs font-bold text-brand group-hover/item:translate-x-1 transition-transform">
                                <span>Xem lộ trình</span>
                                <span>→</span>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
      </div>
    </Layout>
  );
}
