import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { getOpportunityList } from '../opportunities/api';
import { getGuidanceList } from '../guidance/api';
import { hubDeadlineLabel } from '../opportunities/hub-deadline';
import type { PublicOpportunityListItem } from '../opportunities/contracts';
import { getForumPosts, getPostComments } from '../forum/api';
import type { ForumPost } from '../forum/contracts';
import type { GuidanceStage } from '../guidance/contracts';
import googleGLogo from '../../assets/google-g-logo.svg';
import './home.css';

interface HomeForumPostItem extends ForumPost {
  commentsCount: number;
}

function formatRelativeTime(instant: string): string {
  try {
    const date = new Date(instant);
    const now = new Date();
    const diffSec = Math.max(
      0,
      Math.floor((now.getTime() - date.getTime()) / 1000),
    );
    if (diffSec < 60) return 'Vừa xong';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} giờ trước`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 30) return `${diffDay} ngày trước`;
    const diffMonth = Math.floor(diffDay / 30);
    if (diffMonth < 12) return `${diffMonth} tháng trước`;
    return `${Math.floor(diffMonth / 12)} năm trước`;
  } catch {
    return '';
  }
}

export function HomePage() {
  const { user, status } = useAuth();
  const isStudent = status === 'authenticated' && user?.role === 'Student';

  const [opportunities, setOpportunities] = useState<
    PublicOpportunityListItem[]
  >([]);
  const [evaluatedAt, setEvaluatedAt] = useState<string>('');
  const [isLoadingOpps, setIsLoadingOpps] = useState(true);
  const [hasErrorOpps, setHasErrorOpps] = useState(false);
  const [guidanceStages, setGuidanceStages] = useState<GuidanceStage[]>([]);

  const [forumPosts, setForumPosts] = useState<HomeForumPostItem[]>([]);
  const [isLoadingForum, setIsLoadingForum] = useState(true);
  const [hasErrorForum, setHasErrorForum] = useState(false);

  useEffect(() => {
    const oppController = new AbortController();
    setIsLoadingOpps(true);
    setHasErrorOpps(false);

    getOpportunityList(
      new URLSearchParams({ pageSize: '3' }),
      oppController.signal,
    )
      .then((data) => {
        setOpportunities(data.items);
        setEvaluatedAt(data.meta.evaluatedAt);
        setIsLoadingOpps(false);
      })
      .catch(() => {
        if (oppController.signal.aborted) return;
        setIsLoadingOpps(false);
        setHasErrorOpps(true);
      });

    const forumController = new AbortController();
    setIsLoadingForum(true);
    setHasErrorForum(false);

    getForumPosts(
      new URLSearchParams({ pageSize: '3' }),
      forumController.signal,
    )
      .then(async (data) => {
        if (forumController.signal.aborted) return;
        const postsWithComments = await Promise.all(
          data.items.map(async (post) => {
            try {
              const commentsRes = await getPostComments(
                String(post.id),
                new URLSearchParams({ pageSize: '1' }),
                forumController.signal,
              );
              return { ...post, commentsCount: commentsRes.meta.total };
            } catch {
              return { ...post, commentsCount: 0 };
            }
          }),
        );
        if (forumController.signal.aborted) return;
        setForumPosts(postsWithComments);
        setIsLoadingForum(false);
      })
      .catch(() => {
        if (forumController.signal.aborted) return;
        setIsLoadingForum(false);
        setHasErrorForum(true);
      });

    const guidanceController = new AbortController();
    getGuidanceList({ signal: guidanceController.signal })
      .then((data) => {
        if (guidanceController.signal.aborted) return;
        setGuidanceStages(data.stages);
      })
      .catch(() => {
        // Safe fallback; default seed IDs and titles will be used
      });

    return () => {
      oppController.abort();
      forumController.abort();
      guidanceController.abort();
    };
  }, []);

  const year1Item = guidanceStages.find((s) => s.academicYear === 1)?.items[0];
  const year2Item = guidanceStages.find((s) => s.academicYear === 2)?.items[0];
  const year3Item = guidanceStages.find((s) => s.academicYear === 3)?.items[0];
  const year4Item = guidanceStages.find((s) => s.academicYear === 4)?.items[0];

  const year1Id = year1Item?.id ?? 119;
  const year2Id = year2Item?.id ?? 120;
  const year3Id = year3Item?.id ?? 121;
  const year4Id = year4Item?.id ?? 122;

  const year1Desc =
    year1Item?.title ||
    'Nền tảng tư duy thuật toán, cấu trúc máy tính và kỹ năng lập trình cơ bản';
  const year2Desc =
    year2Item?.title ||
    'Thiết kế cơ sở dữ liệu quan hệ, phát triển Web Backend và kiến trúc mạng';
  const year3Desc =
    year3Item?.title ||
    'Hệ thống phân tán, tối ưu hóa hiệu năng và triển khai CI/CD ứng dụng';
  const year4Desc =
    year4Item?.title ||
    'Hoàn thiện đồ án tốt nghiệp, chuẩn bị portfolio kỹ thuật và phỏng vấn chuyên môn';

  return (
    <div className="w-full space-y-12 pb-12">
      {/* 1. HERO SECTION */}
      <section
        aria-label="Giới thiệu UniHub"
        className="relative overflow-hidden rounded-card bg-[#CAF0F8] p-6 sm:p-10 lg:p-12 shadow-soft"
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] items-center gap-8 lg:gap-12">
          {/* Left Hero Content */}
          <div className="z-10 animate-fade-in-up">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#E0F2FE]/90 px-3.5 py-1.5 text-xs font-bold tracking-wide text-brand mb-4 shadow-sm border border-brand/10">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand"></span>
              </span>
              UNIHUB · ĐỒNG HÀNH CÙNG SINH VIÊN
            </span>
            <h1 className="text-2xl sm:text-3xl lg:text-[32px] lg:leading-[40px] font-bold text-navy">
              Học tập, cơ hội và định hướng —<br className="hidden sm:inline" />{' '}
              tất cả tại một nơi.
            </h1>
            <p className="mt-4 text-sm sm:text-base leading-relaxed text-secondary max-w-xl animate-fade-in-up-delay-1">
              Khám phá thực tập, việc làm, học bổng và lộ trình kỹ năng; theo
              dõi những điều quan trọng trong hành trình đại học.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4 animate-fade-in-up-delay-2">
              <Link
                to="/opportunities"
                className="inline-flex h-10 items-center justify-center rounded-control bg-brand px-5 text-sm font-medium text-white shadow-button hover:brightness-95 hover:scale-[1.02] active:scale-[0.98] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              >
                Khám phá cơ hội
              </Link>
              <Link
                to="/roadmaps"
                className="group inline-flex h-10 items-center justify-center px-4 text-sm font-medium text-brand hover:underline"
              >
                <span>Xem lộ trình nghề nghiệp</span>
                <span className="ml-1 inline-block transition-transform duration-200 group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </div>
          </div>

          {/* Right Hero Cluster Illustration */}
          <div className="hero-cluster relative flex flex-col items-center lg:items-end justify-center min-h-[300px]">
            {/* Background Decorative Cap Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-pulse-watermark">
              <svg
                viewBox="0 0 24 24"
                className="w-48 h-48 text-brand fill-current"
                aria-hidden="true"
              >
                <path d="M12 3 1 9l11 6 9-4.91V17h2V9L12 3zm0 14.54-7.5-4.09V17c0 3.31 3.36 6 7.5 6s7.5-2.69 7.5-6v-3.55L12 17.54z" />
              </svg>
            </div>

            {/* Floating Card 1: Top Milestone */}
            <Link
              to="/roadmaps"
              className="animate-float-slow w-full max-w-[270px] rounded-card border border-line bg-white/95 p-3.5 shadow-soft transition-all duration-300 hover:scale-105 hover:shadow-md lg:mr-10 mb-[-12px] z-10 block"
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
                <span className="text-[11px] font-semibold text-[#00677D]">
                  Lộ trình · Năm 2
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-ink">
                Cấu trúc dữ liệu & Git
              </p>
            </Link>

            {/* Floating Card 2: Middle Job Card */}
            {opportunities[0] ? (
              <Link
                to={`/opportunities/${opportunities[0].id}`}
                className="animate-float-medium w-full max-w-[290px] rounded-card border border-line bg-white p-4 shadow-public-card transition-all duration-300 hover:scale-105 hover:shadow-xl z-20 block"
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex rounded-full bg-info-surface px-2 py-0.5 text-[11px] font-semibold text-info">
                    {opportunities[0].type}
                  </span>
                  {opportunities[0].isVerified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-surface px-2 py-0.5 text-[11px] font-semibold text-success">
                      <svg
                        className="h-3 w-3"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Verified
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm font-bold text-navy line-clamp-1">
                  {opportunities[0].title}
                </p>
                <p className="text-xs text-muted truncate">
                  {opportunities[0].publisher}
                  {opportunities[0].location
                    ? ` · ${opportunities[0].location}`
                    : ''}
                </p>
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                  <span className="font-medium text-amber-700">
                    {opportunities[0].deadline?.date
                      ? `Hạn: ${opportunities[0].deadline.date}`
                      : 'Đang mở'}
                  </span>
                  <span className="text-brand font-bold transition-transform duration-200 group-hover:translate-x-1">
                    →
                  </span>
                </div>
              </Link>
            ) : (
              <Link
                to="/opportunities"
                className="animate-float-medium w-full max-w-[290px] rounded-card border border-line bg-white p-4 shadow-public-card transition-all duration-300 hover:scale-105 hover:shadow-xl z-20 block"
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex rounded-full bg-info-surface px-2 py-0.5 text-[11px] font-semibold text-info">
                    Thực tập
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-surface px-2 py-0.5 text-[11px] font-semibold text-success">
                    <svg
                      className="h-3 w-3"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Verified
                  </span>
                </div>
                <p className="mt-2 text-sm font-bold text-navy">
                  Frontend React Developer
                </p>
                <p className="text-xs text-muted">FPT Software · Hà Nội</p>
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                  <span className="font-medium text-amber-700">
                    Hạn: 15/11/2025
                  </span>
                  <span className="text-brand font-bold">→</span>
                </div>
              </Link>
            )}

            {/* Floating Card 3: Bottom Reminder */}
            {opportunities[1] ? (
              <Link
                to={`/opportunities/${opportunities[1].id}`}
                className="animate-float-reverse w-full max-w-[260px] rounded-card border border-line bg-white/95 p-3 shadow-soft transition-all duration-300 hover:scale-105 hover:shadow-md lg:mr-4 mt-[-12px] z-30 flex items-center gap-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 text-sm">
                  🎓
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted">Cơ hội nổi bật</p>
                  <p className="text-xs font-semibold text-ink truncate">
                    {opportunities[1].title}
                  </p>
                </div>
              </Link>
            ) : (
              <Link
                to="/opportunities"
                className="animate-float-reverse w-full max-w-[260px] rounded-card border border-line bg-white/95 p-3 shadow-soft transition-all duration-300 hover:scale-105 hover:shadow-md lg:mr-4 mt-[-12px] z-30 flex items-center gap-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 text-sm">
                  🎓
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted">Nhắc hạn nộp</p>
                  <p className="text-xs font-semibold text-ink truncate">
                    Học bổng Tài năng 2025
                  </p>
                </div>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* 2. BẮT ĐẦU TỪ ĐIỀU BẠN CẦN */}
      <section className="mt-14" aria-labelledby="start-heading">
        <h2
          id="start-heading"
          className="text-xl sm:text-2xl font-bold text-navy"
        >
          Bắt đầu từ điều bạn cần
        </h2>
        <p className="mt-1 text-sm text-muted">
          Lối tắt nhanh đến các phân hệ cốt lõi dành cho sinh viên.
        </p>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Tìm cơ hội */}
          <Link
            to="/opportunities"
            className="group flex flex-col justify-between rounded-card border border-line bg-white p-5 shadow-soft hover:shadow-lg hover:border-brand/40 hover:-translate-y-1.5 transition-all duration-300 ease-out"
          >
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info-surface text-brand transition-all duration-300 group-hover:bg-brand group-hover:text-white group-hover:scale-110">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.7}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20 7h-4V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM9 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2H9V5z"
                  />
                </svg>
              </div>
              <h3 className="mt-4 text-base font-semibold text-ink group-hover:text-brand transition-colors">
                Tìm cơ hội
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Hàng trăm tin thực tập, việc làm và học bổng đã duyệt.
              </p>
            </div>
            <span className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-brand">
              Truy cập{' '}
              <span className="transition-transform duration-200 group-hover:translate-x-1.5">
                →
              </span>
            </span>
          </Link>

          {/* Card 2: Lộ trình kỹ năng */}
          <Link
            to="/roadmaps"
            className="group flex flex-col justify-between rounded-card border border-line bg-white p-5 shadow-soft hover:shadow-lg hover:border-brand/40 hover:-translate-y-1.5 transition-all duration-300 ease-out"
          >
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info-surface text-brand transition-all duration-300 group-hover:bg-brand group-hover:text-white group-hover:scale-110">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.7}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0 0 21 18.382V7.618a1 1 0 0 0-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
              </div>
              <h3 className="mt-4 text-base font-semibold text-ink group-hover:text-brand transition-colors">
                Lộ trình kỹ năng
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Định hướng môn học và kỹ năng theo 4 năm đại học.
              </p>
            </div>
            <span className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-brand">
              Khám phá{' '}
              <span className="transition-transform duration-200 group-hover:translate-x-1.5">
                →
              </span>
            </span>
          </Link>

          {/* Card 3: Diễn đàn sinh viên */}
          <Link
            to="/forum"
            className="group flex flex-col justify-between rounded-card border border-line bg-white p-5 shadow-soft hover:shadow-lg hover:border-brand/40 hover:-translate-y-1.5 transition-all duration-300 ease-out"
          >
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info-surface text-brand transition-all duration-300 group-hover:bg-brand group-hover:text-white group-hover:scale-110">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.7}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h3 className="mt-4 text-base font-semibold text-ink group-hover:text-brand transition-colors">
                Diễn đàn sinh viên
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Trao đổi hỏi đáp về học tập và phỏng vấn nghề nghiệp.
              </p>
            </div>
            <span className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-brand">
              Thảo luận{' '}
              <span className="transition-transform duration-200 group-hover:translate-x-1.5">
                →
              </span>
            </span>
          </Link>

          {/* Card 4: Lịch & Deadline */}
          <Link
            to={isStudent ? '/calendar' : '/login'}
            className="group flex flex-col justify-between rounded-card border border-line bg-white p-5 shadow-soft hover:shadow-lg hover:border-brand/40 hover:-translate-y-1.5 transition-all duration-300 ease-out"
          >
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info-surface text-brand transition-all duration-300 group-hover:bg-brand group-hover:text-white group-hover:scale-110">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.7}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"
                  />
                </svg>
              </div>
              <h3 className="mt-4 text-base font-semibold text-ink group-hover:text-brand transition-colors">
                Lịch & Deadline
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                {isStudent
                  ? 'Quản lý lịch cá nhân và theo dõi các deadline quan trọng.'
                  : 'Quản lý lịch và deadline. Đăng nhập để dùng.'}
              </p>
            </div>
            <span className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-brand">
              {isStudent ? 'Xem lịch' : 'Đăng nhập'}{' '}
              <span className="transition-transform duration-200 group-hover:translate-x-1.5">
                →
              </span>
            </span>
          </Link>
        </div>
      </section>

      {/* 3. KHÁM PHÁ CƠ HỘI ĐANG MỞ */}
      <section className="mt-14" aria-labelledby="opportunities-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2
              id="opportunities-heading"
              className="text-xl sm:text-2xl font-bold text-navy"
            >
              Khám phá cơ hội đang mở
            </h2>
            <p className="mt-1 text-sm text-muted">
              Thực tập, việc làm và học bổng dành cho sinh viên.
            </p>
          </div>
          <Link
            to="/opportunities"
            className="text-sm font-medium text-brand hover:underline"
          >
            Xem tất cả cơ hội →
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {isLoadingOpps ? (
            Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="flex flex-col justify-between rounded-card border border-line bg-white p-6 shadow-soft animate-pulse"
              >
                <div>
                  <div className="flex gap-2">
                    <div className="h-5 w-16 rounded-full bg-slate-100" />
                    <div className="h-5 w-16 rounded-full bg-slate-100" />
                  </div>
                  <div className="mt-3 h-5 w-4/5 rounded bg-slate-100" />
                  <div className="mt-2 h-4 w-1/2 rounded bg-slate-100" />
                  <div className="mt-4 space-y-2">
                    <div className="h-3 w-3/5 rounded bg-slate-100" />
                    <div className="h-3 w-2/5 rounded bg-slate-100" />
                  </div>
                </div>
                <div className="mt-6 h-10 w-full rounded-control bg-slate-100" />
              </div>
            ))
          ) : hasErrorOpps || opportunities.length === 0 ? (
            <div className="col-span-full rounded-card border border-line bg-white p-8 text-center shadow-soft">
              <p className="text-sm text-secondary">
                {hasErrorOpps
                  ? 'Tạm thời chưa tải được danh sách cơ hội mới nhất.'
                  : 'Hiện tại chưa có cơ hội nào đang mở.'}
              </p>
              <Link
                to="/opportunities"
                className="mt-4 inline-flex items-center justify-center rounded-control bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-button hover:brightness-95 transition-all"
              >
                Khám phá Hub cơ hội
              </Link>
            </div>
          ) : (
            opportunities.map((item) => {
              const deadlineInfo = hubDeadlineLabel(item.deadline, evaluatedAt);
              return (
                <article
                  key={item.id}
                  className="group flex flex-col justify-between rounded-card border border-line bg-white p-6 shadow-soft hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 ease-out"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-info-surface px-2.5 py-0.5 text-xs font-semibold text-info">
                        {item.type}
                      </span>
                      {item.isVerified && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success-surface px-2.5 py-0.5 text-xs font-semibold text-success">
                          <svg
                            className="h-3.5 w-3.5"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Verified
                        </span>
                      )}
                    </div>
                    <h3 className="mt-3 text-base font-bold text-ink leading-snug line-clamp-2 group-hover:text-brand transition-colors">
                      {item.title}
                    </h3>
                    {item.publisher && (
                      <p className="mt-1 text-sm font-medium text-secondary truncate">
                        {item.publisher}
                      </p>
                    )}
                    <div className="mt-4 space-y-1.5 text-xs text-muted">
                      <p className="flex items-center gap-1.5 truncate">
                        <span aria-hidden="true">📍</span>{' '}
                        {item.workFormat ? `${item.workFormat} · ` : ''}
                        {item.location || 'Toàn quốc'}
                      </p>
                      {deadlineInfo ? (
                        <p
                          className={`flex items-center gap-1.5 font-medium ${
                            deadlineInfo.variant === 'error'
                              ? 'text-danger'
                              : deadlineInfo.variant === 'warning'
                                ? 'text-amber-800'
                                : 'text-secondary'
                          }`}
                        >
                          <span aria-hidden="true">⏰</span> {deadlineInfo.text}
                        </p>
                      ) : (
                        <p className="flex items-center gap-1.5 text-muted">
                          <span aria-hidden="true">⏰</span> Hạn nộp: Đang cập
                          nhật
                        </p>
                      )}
                    </div>
                  </div>
                  <Link
                    to={`/opportunities/${item.id}`}
                    className="mt-6 block w-full rounded-control border border-control bg-white py-2.5 text-center text-sm font-medium text-brand group-hover:bg-brand group-hover:text-white group-hover:border-transparent transition-all duration-200"
                  >
                    Xem chi tiết
                  </Link>
                </article>
              );
            })
          )}
        </div>
      </section>

      {/* 4. BANNER CƠ HỘI PHÙ HỢP HƠN KHI HIỂU VỀ BẠN */}
      <section className="mt-14" aria-label="Khuyến khích đăng nhập">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 rounded-card border border-line bg-white p-6 sm:p-8 shadow-soft hover:shadow-md hover:border-brand/30 transition-all duration-300">
          <div>
            <h2 className="text-lg font-bold text-navy">
              Cơ hội phù hợp hơn khi hiểu về bạn
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-secondary max-w-2xl">
              {isStudent
                ? 'Bổ sung hoặc cập nhật chuyên ngành, năm học và kỹ năng để hệ thống đề xuất các cơ hội phù hợp nhất với năng lực của bạn.'
                : 'Đăng nhập bằng Google và bổ sung chuyên ngành, năm học, kỹ năng để nhận gợi ý phù hợp nhất với năng lực của bạn.'}
            </p>
          </div>
          {isStudent ? (
            <Link
              to="/profile"
              className="shrink-0 inline-flex items-center gap-2 rounded-control bg-brand px-6 py-3 text-sm font-semibold text-white shadow-button hover:brightness-95 hover:scale-[1.02] active:scale-[0.98] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            >
              <span>Hồ sơ cá nhân</span>
              <span
                aria-hidden="true"
                className="transition-transform duration-200 group-hover:translate-x-1"
              >
                →
              </span>
            </Link>
          ) : (
            <Link
              to="/login"
              className="shrink-0 inline-flex items-center gap-3 rounded-control bg-navy px-6 py-3 text-sm font-semibold text-white shadow-button hover:bg-navy/90 hover:scale-[1.02] active:scale-[0.98] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            >
              <img
                src={googleGLogo}
                alt=""
                aria-hidden="true"
                className="h-4 w-4 bg-white rounded-full p-0.5 shrink-0"
              />
              Đăng nhập với Google
            </Link>
          )}
        </div>
      </section>

      {/* 5. ĐỊNH HƯỚNG RÕ HƠN CHO TỪNG NĂM ĐẠI HỌC */}
      <section className="mt-14" aria-labelledby="roadmap-heading">
        <h2
          id="roadmap-heading"
          className="text-xl sm:text-2xl font-bold text-navy"
        >
          Định hướng rõ hơn cho từng năm đại học
        </h2>
        <p className="mt-1 text-sm text-muted">
          Khám phá lộ trình kỹ năng và các bài viết theo chuyên ngành.
        </p>

        <div className="group/roadmap mt-6 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 rounded-card border border-line bg-white p-6 shadow-soft hover:shadow-lg hover:border-brand/30 hover:-translate-y-1 transition-all duration-300 items-center">
          {/* Left Summary */}
          <div className="border-b lg:border-b-0 lg:border-r border-line pb-6 lg:pb-0 lg:pr-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info-surface text-brand group-hover/roadmap:scale-110 group-hover/roadmap:rotate-6 transition-transform duration-300">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.7}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h3 className="mt-3 text-lg font-bold text-ink">
              Tự tin qua từng giai đoạn
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-secondary">
              Lộ trình được thiết kế bài bản theo từng chặng đường đại học, giúp
              sinh viên tập trung vào các kỹ năng nền tảng tới chuyên môn và cơ
              hội nghề nghiệp.
            </p>
            <Link
              to="/roadmaps"
              className="mt-5 inline-flex items-center justify-center rounded-control bg-brand px-4 py-2 text-xs font-semibold text-white hover:brightness-95 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-button"
            >
              Khám phá lộ trình
            </Link>
          </div>

          {/* Right 4 Years Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Năm 1 */}
            <Link
              to={`/roadmaps/${year1Id}`}
              className="group/year rounded-control border border-line bg-page p-3.5 flex flex-col justify-between hover:border-[#0077B6]/60 hover:bg-white hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 ease-out"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded bg-[#0077B6] px-2 py-0.5 text-[11px] font-bold text-white group-hover/year:scale-105 transition-transform duration-200 shadow-xs">
                    Năm 1
                  </span>
                  <span className="text-muted text-xs group-hover/year:scale-125 group-hover/year:rotate-12 transition-transform duration-200 inline-block">
                    🌱
                  </span>
                </div>
                <h4 className="mt-2.5 text-xs font-bold text-ink group-hover/year:text-brand transition-colors">
                  Nhập môn & Nền tảng
                </h4>
                <p
                  className="mt-1 text-[11px] leading-relaxed text-muted line-clamp-2"
                  title={year1Desc}
                >
                  {year1Desc}
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-line/40 flex items-center justify-between text-[11px] font-medium text-brand">
                <span className="text-muted group-hover/year:text-brand transition-colors duration-200">
                  Xem chi tiết
                </span>
                <span className="transform group-hover/year:translate-x-1 transition-transform duration-200 ml-auto">
                  →
                </span>
              </div>
            </Link>

            {/* Năm 2 */}
            <Link
              to={`/roadmaps/${year2Id}`}
              className="group/year rounded-control border border-line bg-page p-3.5 flex flex-col justify-between hover:border-[#0D9488]/60 hover:bg-white hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 ease-out"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded bg-[#0D9488] px-2 py-0.5 text-[11px] font-bold text-white group-hover/year:scale-105 transition-transform duration-200 shadow-xs">
                    Năm 2
                  </span>
                  <span className="text-muted text-xs group-hover/year:scale-125 group-hover/year:rotate-12 transition-transform duration-200 inline-block">
                    ⚡
                  </span>
                </div>
                <h4 className="mt-2.5 text-xs font-bold text-ink group-hover/year:text-brand transition-colors">
                  Kỹ năng chuyên sâu
                </h4>
                <p
                  className="mt-1 text-[11px] leading-relaxed text-muted line-clamp-2"
                  title={year2Desc}
                >
                  {year2Desc}
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-line/40 flex items-center justify-between text-[11px] font-medium text-brand">
                <span className="text-muted group-hover/year:text-brand transition-colors duration-200">
                  Xem chi tiết
                </span>
                <span className="transform group-hover/year:translate-x-1 transition-transform duration-200 ml-auto">
                  →
                </span>
              </div>
            </Link>

            {/* Năm 3 */}
            <Link
              to={`/roadmaps/${year3Id}`}
              className="group/year rounded-control border border-line bg-page p-3.5 flex flex-col justify-between hover:border-[#0284C7]/60 hover:bg-white hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 ease-out"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded bg-[#0284C7] px-2 py-0.5 text-[11px] font-bold text-white group-hover/year:scale-105 transition-transform duration-200 shadow-xs">
                    Năm 3
                  </span>
                  <span className="text-muted text-xs group-hover/year:scale-125 group-hover/year:rotate-12 transition-transform duration-200 inline-block">
                    💼
                  </span>
                </div>
                <h4 className="mt-2.5 text-xs font-bold text-ink group-hover/year:text-brand transition-colors">
                  Thực tập & Dự án
                </h4>
                <p
                  className="mt-1 text-[11px] leading-relaxed text-muted line-clamp-2"
                  title={year3Desc}
                >
                  {year3Desc}
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-line/40 flex items-center justify-between text-[11px] font-medium text-brand">
                <span className="text-muted group-hover/year:text-brand transition-colors duration-200">
                  Xem chi tiết
                </span>
                <span className="transform group-hover/year:translate-x-1 transition-transform duration-200 ml-auto">
                  →
                </span>
              </div>
            </Link>

            {/* Năm 4 */}
            <Link
              to={`/roadmaps/${year4Id}`}
              className="group/year rounded-control border border-line bg-page p-3.5 flex flex-col justify-between hover:border-[#1E3A8A]/60 hover:bg-white hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 ease-out"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded bg-[#1E3A8A] px-2 py-0.5 text-[11px] font-bold text-white group-hover/year:scale-105 transition-transform duration-200 shadow-xs">
                    Năm 4
                  </span>
                  <span className="text-muted text-xs group-hover/year:scale-125 group-hover/year:rotate-12 transition-transform duration-200 inline-block">
                    🎓
                  </span>
                </div>
                <h4 className="mt-2.5 text-xs font-bold text-ink group-hover/year:text-brand transition-colors">
                  Tốt nghiệp & Đi làm
                </h4>
                <p
                  className="mt-1 text-[11px] leading-relaxed text-muted line-clamp-2"
                  title={year4Desc}
                >
                  {year4Desc}
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-line/40 flex items-center justify-between text-[11px] font-medium text-brand">
                <span className="text-muted group-hover/year:text-brand transition-colors duration-200">
                  Xem chi tiết
                </span>
                <span className="transform group-hover/year:translate-x-1 transition-transform duration-200 ml-auto">
                  →
                </span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* 6. CHỦ ĐỘNG VỚI LỊCH VÀ DEADLINE */}
      <section className="mt-14" aria-labelledby="schedule-heading">
        <div className="group/schedule grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] items-center gap-8 rounded-card border border-line bg-white p-6 sm:p-8 shadow-soft hover:shadow-lg hover:border-brand/30 hover:-translate-y-1 transition-all duration-300">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-info-surface px-3 py-1 text-xs font-semibold text-brand mb-3 group-hover/schedule:scale-105 transition-transform duration-200">
              <span className="inline-block group-hover/schedule:rotate-12 transition-transform duration-200">
                📅
              </span>{' '}
              Quản lý tiến độ
            </span>
            <h2
              id="schedule-heading"
              className="text-xl sm:text-2xl font-bold text-navy"
            >
              Chủ động với lịch và deadline
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-secondary max-w-xl">
              UniHub giúp bạn theo dõi hạn nộp bài tập, lịch thi và hạn ứng
              tuyển học bổng tự động ngay trên trang cá nhân mà không bỏ sót cơ
              hội quan trọng.
            </p>
            <div className="mt-6">
              <Link
                to={isStudent ? '/calendar' : '/login'}
                className="inline-flex items-center gap-2 rounded-control bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-button hover:brightness-95 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <span>
                  {isStudent ? 'Mở Lịch & Deadline' : 'Đăng nhập để xem lịch'}
                </span>
                <span
                  aria-hidden="true"
                  className="transform group-hover/schedule:translate-x-1 transition-transform"
                >
                  →
                </span>
              </Link>
            </div>
          </div>

          <Link
            to={isStudent ? '/calendar' : '/login'}
            className="group/deadline block rounded-card border border-line bg-page p-4 shadow-sm hover:border-brand/50 hover:bg-white hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 ease-out"
          >
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <span className="text-sm font-bold text-navy group-hover/deadline:text-brand transition-colors">
                Lịch & Deadline sắp tới
              </span>
              <span className="text-muted text-sm group-hover/deadline:scale-125 group-hover/deadline:rotate-12 transition-transform duration-300 inline-block">
                🗓️
              </span>
            </div>
            <div className="mt-3 space-y-2.5">
              {opportunities.filter((o) => o.deadline?.date).length > 0 ? (
                opportunities
                  .filter((o) => o.deadline?.date)
                  .slice(0, 2)
                  .map((opp, idx) => (
                    <div
                      key={opp.id}
                      className="flex items-center justify-between gap-3 p-1.5 -mx-1.5 rounded-md hover:bg-slate-50 transition-colors duration-200"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        {idx === 0 ? (
                          <span className="relative flex h-2.5 w-2.5 shrink-0 mt-1">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                          </span>
                        ) : (
                          <span className="relative flex h-2.5 w-2.5 shrink-0 mt-1">
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-ink truncate group-hover/deadline:text-brand transition-colors">
                            {opp.title}
                          </p>
                          <p className="text-[11px] text-muted">
                            {opp.deadline?.date || 'Đang mở'} · {opp.publisher}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold group-hover/deadline:scale-105 transition-transform duration-200 ${
                          idx === 0
                            ? 'bg-warning-surface text-warning'
                            : 'bg-info-surface text-brand'
                        }`}
                      >
                        {idx === 0 ? 'Deadline gần' : 'Sắp tới'}
                      </span>
                    </div>
                  ))
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3 p-1.5 -mx-1.5 rounded-md hover:bg-slate-50 transition-colors duration-200">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="relative flex h-2.5 w-2.5 shrink-0 mt-1">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-ink truncate group-hover/deadline:text-brand transition-colors">
                          Hạn nộp FPT Software
                        </p>
                        <p className="text-[11px] text-muted">
                          15:00 · ngày mai
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-warning-surface px-2 py-0.5 text-[10px] font-semibold text-warning group-hover/deadline:scale-105 transition-transform duration-200">
                      Deadline gần
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 p-1.5 -mx-1.5 rounded-md hover:bg-slate-50 transition-colors duration-200">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="relative flex h-2.5 w-2.5 shrink-0 mt-1">
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-ink truncate group-hover/deadline:text-brand transition-colors">
                          Học bổng Viettel Digital
                        </p>
                        <p className="text-[11px] text-muted">30/11/2025</p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-info-surface px-2 py-0.5 text-[10px] font-semibold text-brand group-hover/deadline:scale-105 transition-transform duration-200">
                      Sắp tới
                    </span>
                  </div>
                </>
              )}
            </div>
            <div className="mt-3.5 pt-2.5 border-t border-line/60 flex items-center justify-between text-xs text-brand font-medium">
              <span>Xem toàn bộ lịch trình</span>
              <span className="transform group-hover/deadline:translate-x-1.5 transition-transform duration-200">
                →
              </span>
            </div>
          </Link>
        </div>
      </section>

      {/* 7. CÙNG HỌC HỎI TỪ CỘNG ĐỒNG SINH VIÊN */}
      <section className="mt-14 mb-16" aria-labelledby="community-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2
              id="community-heading"
              className="text-xl sm:text-2xl font-bold text-navy"
            >
              Cùng học hỏi từ cộng đồng sinh viên
            </h2>
            <p className="mt-1 text-sm text-muted">
              Trao đổi về học tập, thực tập và kinh nghiệm phỏng vấn.
            </p>
          </div>
          <Link
            to="/forum"
            className="text-sm font-medium text-brand hover:underline"
          >
            Khám phá diễn đàn →
          </Link>
        </div>

        {isLoadingForum ? (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="animate-pulse rounded-card border border-line bg-white p-5 shadow-soft flex flex-col justify-between min-h-[160px]"
              >
                <div>
                  <div className="h-5 w-28 rounded-full bg-slate-200" />
                  <div className="mt-3 h-5 w-5/6 rounded bg-slate-200" />
                  <div className="mt-2 h-4 w-2/3 rounded bg-slate-200" />
                </div>
                <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-3">
                  <div className="h-4 w-32 rounded bg-slate-200" />
                  <div className="h-4 w-12 rounded bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        ) : hasErrorForum || forumPosts.length === 0 ? (
          <div className="mt-6 rounded-card border border-line bg-white p-8 text-center shadow-soft">
            <p className="text-sm text-secondary">
              {hasErrorForum
                ? 'Không thể tải danh sách bài viết diễn đàn lúc này.'
                : 'Chưa có bài viết thảo luận nào.'}
            </p>
            <Link
              to="/forum"
              className="mt-4 inline-flex items-center justify-center rounded-control bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-button hover:brightness-95 transition-all"
            >
              Khám phá diễn đàn
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            {forumPosts.map((post) => (
              <Link
                key={post.id}
                to={`/forum/${post.id}`}
                className="group flex flex-col justify-between rounded-card border border-line bg-white p-5 shadow-soft hover:shadow-lg hover:border-brand/40 hover:-translate-y-1.5 transition-all duration-300 ease-out"
              >
                <div>
                  <span className="rounded-full bg-info-surface px-2.5 py-0.5 text-xs font-semibold text-info">
                    {post.topic}
                  </span>
                  <h3 className="mt-3 text-sm sm:text-base font-bold text-ink leading-snug line-clamp-2 group-hover:text-brand transition-colors">
                    {post.title}
                  </h3>
                </div>
                <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-subtle">
                  <span>
                    {post.author.fullName} ·{' '}
                    {formatRelativeTime(post.createdAt)}
                  </span>
                  <span className="flex items-center gap-1 font-medium group-hover:text-brand transition-colors">
                    💬 {post.commentsCount}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
