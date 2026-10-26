import { useId, type ReactNode } from 'react';
import { Button } from './Button';

export interface FeedbackStateProps {
  title: string;
  description: string;
  className?: string;
  children?: ReactNode;
}

export function LoadingState({
  title = 'Đang tải',
  description = 'Vui lòng chờ trong giây lát.',
  className = '',
}: Partial<FeedbackStateProps> = {}) {
  return (
    <section
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`rounded-card border border-line bg-white p-6 text-center ${className}`}
    >
      <span
        aria-hidden="true"
        className="mx-auto mb-3 block h-6 w-6 animate-spin rounded-full border-2 border-brand border-r-transparent motion-reduce:animate-none"
      />
      <h3 className="type-title text-navy">{title}</h3>
      {description && (
        <p className="mt-2 type-label text-muted">{description}</p>
      )}
    </section>
  );
}

export function EmptyState({
  title,
  description,
  className = '',
  children,
}: FeedbackStateProps) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className={`rounded-card border border-line bg-white p-6 text-center ${className}`}
    >
      <h3 id={titleId} className="type-title text-navy">
        {title}
      </h3>
      <p className="mt-2 type-label text-muted">{description}</p>
      {children && <div className="mt-4 flex justify-center">{children}</div>}
    </section>
  );
}

export interface ErrorStateProps extends FeedbackStateProps {
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  title,
  description,
  className = '',
  children,
  onRetry,
  retryLabel = 'Thử lại',
}: ErrorStateProps) {
  const titleId = useId();

  return (
    <section
      role="alert"
      aria-labelledby={titleId}
      className={`rounded-card border border-danger-line bg-danger-surface p-6 ${className}`}
    >
      <h3 id={titleId} className="type-title text-danger">
        {title}
      </h3>
      <p className="mt-2 type-label text-danger">{description}</p>
      {(onRetry || children) && (
        <div className="mt-4 flex gap-3">
          {onRetry && (
            <Button variant="outline" onClick={onRetry}>
              {retryLabel}
            </Button>
          )}
          {children}
        </div>
      )}
    </section>
  );
}
