import { Link } from 'react-router';
import { PublicLayout } from '../layouts/PublicLayout';

export function NotFoundPage() {
  return (
    <PublicLayout activeKey="">
      <div className="mx-auto max-w-public px-8 py-16 text-center">
        <section
          role="region"
          aria-labelledby="not-found-heading"
          className="mx-auto max-w-lg rounded-card border border-line bg-white p-8 shadow-soft"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface text-secondary">
            <span className="text-xl font-bold text-navy">404</span>
          </div>
          <h1
            id="not-found-heading"
            className="mt-4 text-xl font-bold text-navy sm:text-2xl"
          >
            Không tìm thấy trang
          </h1>
          <p className="mt-2 text-sm text-secondary">
            Đường dẫn này chưa có hoặc đã được chuyển dời trong ứng dụng UniHub.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-control bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-button hover:bg-navy transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            >
              Về trang chủ
            </Link>
            <Link
              to="/opportunities"
              className="inline-flex items-center justify-center rounded-control border border-control bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-page transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            >
              Khám phá cơ hội
            </Link>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
