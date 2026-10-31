import { Link } from 'react-router';

export interface PendingFeatureNoticeProps {
  title: string;
  description: string;
  badgeText?: string;
  backTo?: string;
  backLabel?: string;
}

export function PendingFeatureNotice({
  title,
  description,
  badgeText = 'Đang tích hợp',
  backTo = '/opportunities',
  backLabel = 'Khám phá cơ hội',
}: PendingFeatureNoticeProps) {
  return (
    <section
      role="region"
      aria-labelledby="pending-feature-title"
      className="mx-auto max-w-2xl rounded-card border border-line bg-white p-8 text-center shadow-soft"
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-info-surface text-brand">
        <svg
          className="h-7 w-7"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          />
        </svg>
      </div>

      <span className="mt-4 inline-flex items-center rounded-pill bg-info-surface px-3 py-1 text-xs font-semibold text-brand">
        {badgeText}
      </span>

      <h1
        id="pending-feature-title"
        className="mt-3 text-xl font-bold text-navy sm:text-2xl"
      >
        {title}
      </h1>

      <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-secondary">
        {description}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          to={backTo}
          className="inline-flex items-center justify-center rounded-control bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-button hover:bg-navy transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        >
          {backLabel}
        </Link>
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-control border border-control bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-page transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        >
          Về trang chủ
        </Link>
      </div>
    </section>
  );
}
