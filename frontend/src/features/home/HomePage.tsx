import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { getOpportunityList } from '../opportunities/api';
import { hubDeadlineLabel } from '../opportunities/hub-deadline';
import type { PublicOpportunityListItem } from '../opportunities/contracts';
import googleGLogo from '../../assets/google-g-logo.svg';

export function HomePage() {
  const { user, status } = useAuth();
  const isStudent = status === 'authenticated' && user?.role === 'Student';

  const [opportunities, setOpportunities] = useState<
    PublicOpportunityListItem[]
  >([]);
  const [evaluatedAt, setEvaluatedAt] = useState<string>('');
  const [isLoadingOpps, setIsLoadingOpps] = useState(true);
  const [hasErrorOpps, setHasErrorOpps] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoadingOpps(true);
    setHasErrorOpps(false);

    getOpportunityList(
      new URLSearchParams({ pageSize: '3' }),
      controller.signal,
    )
      .then((data) => {
        setOpportunities(data.items);
        setEvaluatedAt(data.meta.evaluatedAt);
        setIsLoadingOpps(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setIsLoadingOpps(false);
        setHasErrorOpps(true);
      });

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <div className="w-full space-y-12 pb-12">
      {/* 1. HERO SECTION */}
      <section
        aria-label="Giới thiệu UniHub"
        className="relative overflow-hidden rounded-card bg-[#CAF0F8] p-6 sm:p-10 lg:p-12 shadow-soft"
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] items-center gap-8 lg:gap-12">
          {/* Left Hero Content */}
          <div className="z-10">
            <span className="inline-flex items-center rounded-full bg-[#E0F2FE]/80 px-3 py-1 text-xs font-bold tracking-wide text-brand mb-4">
              UNIHUB · ĐỒNG HÀNH CÙNG SINH VIÊN
            </span>
            <h1 className="text-2xl sm:text-3xl lg:text-[32px] lg:leading-[40px] font-bold text-navy">
              Học tập, cơ hội và định hướng —<br className="hidden sm:inline" />{' '}
              tất cả tại một nơi.
            </h1>
            <p className="mt-4 text-sm sm:text-base leading-relaxed text-secondary max-w-xl">
              Khám phá thực tập, việc làm, học bổng và lộ trình kỹ năng; theo
              dõi những điều quan trọng trong hành trình đại học.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/opportunities"
                className="inline-flex h-10 items-center justify-center rounded-control bg-brand px-5 text-sm font-medium text-white shadow-button hover:brightness-95 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              >
                Khám phá cơ hội
              </Link>
              <Link
                to="/roadmaps"
                className="inline-flex h-10 items-center justify-center px-4 text-sm font-medium text-brand hover:underline"
              >
                Xem lộ trình nghề nghiệp
              </Link>
            </div>
          </div>

          {/* Right Hero Cluster Illustration */}
          <div className="relative flex flex-col items-center lg:items-end justify-center min-h-[300px]">
            {/* Background Decorative Cap Watermark */}
            <div className="absolute inset-0 flex items-center justify-center opacity-15 pointer-events-none">
              <svg
                viewBox="0 0 24 24"
                className="w-48 h-48 text-brand fill-current"
                aria-hidden="true"
              >
                <path d="M12 3 1 9l11 6 9-4.91V17h2V9L12 3zm0 14.54-7.5-4.09V17c0 3.31 3.36 6 7.5 6s7.5-2.69 7.5-6v-3.55L12 17.54z" />
              </svg>
            </div>

            {/* Floating Card 1: Top Milestone */}
            <div className="w-full max-w-[270px] rounded-card border border-line bg-white/95 p-3.5 shadow-soft transition-transform hover:-translate-y-0.5 lg:mr-10 mb-[-12px] z-10">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-teal-500" />
                <span className="text-[11px] font-semibold text-[#00677D]">
                  Lộ trình · Năm 2
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-ink">
                Cấu trúc dữ liệu & Git
              </p>
            </div>

            {/* Floating Card 2: Middle Job Card */}
            <div className="w-full max-w-[290px] rounded-card border border-line bg-white p-4 shadow-public-card transition-transform hover:-translate-y-0.5 z-20">
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
            </div>

            {/* Floating Card 3: Bottom Reminder */}
            <div className="w-full max-w-[260px] rounded-card border border-line bg-white/95 p-3 shadow-soft transition-transform hover:-translate-y-0.5 lg:mr-4 mt-[-12px] z-30 flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 text-sm">
                🎓
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted">Nhắc hạn nộp</p>
                <p className="text-xs font-semibold text-ink truncate">
                  Học bổng Tài năng 2025
                </p>
              </div>
            </div>
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
            className="group flex flex-col justify-between rounded-card border border-line bg-white p-5 shadow-soft hover:shadow-md hover:border-brand/40 transition-all"
          >
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info-surface text-brand">
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
              <span className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </span>
          </Link>

          {/* Card 2: Lộ trình kỹ năng */}
          <Link
            to="/roadmaps"
            className="group flex flex-col justify-between rounded-card border border-line bg-white p-5 shadow-soft hover:shadow-md hover:border-brand/40 transition-all"
          >
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info-surface text-brand">
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
              <span className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </span>
          </Link>

          {/* Card 3: Diễn đàn sinh viên */}
          <Link
            to="/forum"
            className="group flex flex-col justify-between rounded-card border border-line bg-white p-5 shadow-soft hover:shadow-md hover:border-brand/40 transition-all"
          >
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info-surface text-brand">
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
              <span className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </span>
          </Link>

          {/* Card 4: Lịch & Deadline */}
          <Link
            to={isStudent ? '/calendar' : '/login'}
            className="group flex flex-col justify-between rounded-card border border-line bg-white p-5 shadow-soft hover:shadow-md hover:border-brand/40 transition-all"
          >
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info-surface text-brand">
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
              <span className="transition-transform group-hover:translate-x-0.5">
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
                  className="flex flex-col justify-between rounded-card border border-line bg-white p-6 shadow-soft hover:shadow-md transition-shadow"
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
                    <h3 className="mt-3 text-base font-bold text-ink leading-snug line-clamp-2">
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
                    className="mt-6 block w-full rounded-control border border-control bg-white py-2.5 text-center text-sm font-medium text-brand hover:bg-page transition-colors"
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
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 rounded-card border border-line bg-white p-6 sm:p-8 shadow-soft">
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
              className="shrink-0 inline-flex items-center gap-2 rounded-control bg-brand px-6 py-3 text-sm font-semibold text-white shadow-button hover:brightness-95 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            >
              <span>Hồ sơ cá nhân</span>
              <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <Link
              to="/login"
              className="shrink-0 inline-flex items-center gap-3 rounded-control bg-navy px-6 py-3 text-sm font-semibold text-white shadow-button hover:bg-navy/90 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
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

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 rounded-card border border-line bg-white p-6 shadow-soft items-center">
          {/* Left Summary */}
          <div className="border-b lg:border-b-0 lg:border-r border-line pb-6 lg:pb-0 lg:pr-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info-surface text-brand">
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
              className="mt-5 inline-flex items-center justify-center rounded-control bg-brand px-4 py-2 text-xs font-semibold text-white hover:brightness-95 transition-all shadow-button"
            >
              Khám phá lộ trình
            </Link>
          </div>

          {/* Right 4 Years Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Năm 1 */}
            <div className="rounded-control border border-line bg-page p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded bg-[#0077B6] px-2 py-0.5 text-[11px] font-bold text-white">
                    Năm 1
                  </span>
                  <span className="text-muted text-xs">🌱</span>
                </div>
                <h4 className="mt-2.5 text-xs font-bold text-ink">
                  Nhập môn & Nền tảng
                </h4>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">
                  Tin học đại cương, Tư duy lập trình, Tiếng Anh giao tiếp.
                </p>
              </div>
            </div>

            {/* Năm 2 */}
            <div className="rounded-control border border-line bg-page p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded bg-[#0D9488] px-2 py-0.5 text-[11px] font-bold text-white">
                    Năm 2
                  </span>
                  <span className="text-muted text-xs">⚡</span>
                </div>
                <h4 className="mt-2.5 text-xs font-bold text-ink">
                  Kỹ năng chuyên sâu
                </h4>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">
                  Cấu trúc dữ liệu, Dự án nhóm, Quy trình Git/GitHub.
                </p>
              </div>
            </div>

            {/* Năm 3 */}
            <div className="rounded-control border border-line bg-page p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded bg-[#0284C7] px-2 py-0.5 text-[11px] font-bold text-white">
                    Năm 3
                  </span>
                  <span className="text-muted text-xs">💼</span>
                </div>
                <h4 className="mt-2.5 text-xs font-bold text-ink">
                  Thực tập & Dự án
                </h4>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">
                  Framework nâng cao, CV chuyên nghiệp, Phỏng vấn thử.
                </p>
              </div>
            </div>

            {/* Năm 4 */}
            <div className="rounded-control border border-line bg-page p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded bg-[#1E3A8A] px-2 py-0.5 text-[11px] font-bold text-white">
                    Năm 4
                  </span>
                  <span className="text-muted text-xs">🎓</span>
                </div>
                <h4 className="mt-2.5 text-xs font-bold text-ink">
                  Tốt nghiệp & Đi làm
                </h4>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">
                  Đồ án tốt nghiệp, Cơ hội việc làm chính thức, Portfolio.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. CHỦ ĐỘNG VỚI LỊCH VÀ DEADLINE */}
      <section className="mt-14" aria-labelledby="schedule-heading">
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] items-center gap-8 rounded-card border border-line bg-white p-6 sm:p-8 shadow-soft">
          <div>
            <span className="inline-flex items-center gap-1 rounded-full bg-info-surface px-3 py-1 text-xs font-semibold text-brand mb-3">
              <span>📅</span> Quản lý tiến độ
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
          </div>

          <div className="rounded-card border border-line bg-page p-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <span className="text-sm font-bold text-navy">
                Tháng 11, 2025
              </span>
              <span className="text-muted text-sm">🗓️</span>
            </div>
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink truncate">
                      Hạn nộp FPT Software
                    </p>
                    <p className="text-[11px] text-muted">15:00 · ngày mai</p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-warning-surface px-2 py-0.5 text-[10px] font-semibold text-warning">
                  Deadline gần
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink truncate">
                      Học bổng Viettel Digital
                    </p>
                    <p className="text-[11px] text-muted">30/11/2025</p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-info-surface px-2 py-0.5 text-[10px] font-semibold text-brand">
                  Sắp tới
                </span>
              </div>
            </div>
          </div>
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

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Post 1 */}
          <article className="flex flex-col justify-between rounded-card border border-line bg-white p-5 shadow-soft hover:shadow-md transition-shadow">
            <div>
              <span className="rounded-full bg-info-surface px-2.5 py-0.5 text-xs font-semibold text-info">
                Kinh nghiệm phỏng vấn
              </span>
              <h3 className="mt-3 text-sm sm:text-base font-bold text-ink leading-snug line-clamp-2">
                Chia sẻ kinh nghiệm phỏng vấn vị trí Software Intern cho sinh
                viên năm 3
              </h3>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-subtle">
              <span>Nguyễn H. · 2 giờ trước</span>
              <span className="flex items-center gap-1 font-medium">💬 18</span>
            </div>
          </article>

          {/* Post 2 */}
          <article className="flex flex-col justify-between rounded-card border border-line bg-white p-5 shadow-soft hover:shadow-md transition-shadow">
            <div>
              <span className="rounded-full bg-info-surface px-2.5 py-0.5 text-xs font-semibold text-info">
                Học tập
              </span>
              <h3 className="mt-3 text-sm sm:text-base font-bold text-ink leading-snug line-clamp-2">
                Cách phân bổ thời gian ôn thi chứng chỉ TOEIC và đồ án chuyên
                ngành hiệu quả
              </h3>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-subtle">
              <span>Trần M. · 1 ngày trước</span>
              <span className="flex items-center gap-1 font-medium">💬 32</span>
            </div>
          </article>

          {/* Post 3 */}
          <article className="flex flex-col justify-between rounded-card border border-line bg-white p-5 shadow-soft hover:shadow-md transition-shadow">
            <div>
              <span className="rounded-full bg-info-surface px-2.5 py-0.5 text-xs font-semibold text-info">
                Thực tập
              </span>
              <h3 className="mt-3 text-sm sm:text-base font-bold text-ink leading-snug line-clamp-2">
                Nên chuẩn bị gì trước kỳ thực tập doanh nghiệp đầu tiên?
              </h3>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-subtle">
              <span>Lê T. · 2 ngày trước</span>
              <span className="flex items-center gap-1 font-medium">💬 14</span>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
