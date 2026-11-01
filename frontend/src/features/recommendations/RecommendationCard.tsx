import { Link } from 'react-router';
import { Badge, Card } from '../../components/ui';
import { formatOpportunityDate } from '../opportunities/contracts';
import type { RecommendedOpportunity } from './contracts';

function deadlineDateTime(instant: string, sourceTimeZone: string): string {
  const format = (timeZone: string) =>
    new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone,
    }).format(new Date(instant));
  try {
    return format(sourceTimeZone) + ' (' + sourceTimeZone + ')';
  } catch {
    // Fall back both calendar date and clock time together, never mix zones.
    return format('UTC') + ' (UTC)';
  }
}

export function RecommendationCard({ item }: { item: RecommendedOpportunity }) {
  const percent = new Intl.NumberFormat('vi-VN', {
    style: 'percent',
    maximumFractionDigits: 2,
  }).format(item.matchScore);
  return (
    <Card className="grid gap-5 p-6">
      <header className="flex flex-wrap items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-compact bg-surface text-brand"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            {item.type === 'Học bổng' ? (
              <>
                <path d="m2 9 10-5 10 5-10 5-10-5Z" />
                <path d="M6 11v6l6 3 6-3v-6M22 9v7" />
              </>
            ) : (
              <>
                <path d="M4 21V3h12v18M16 9h4v12M2 21h20M7 6h2m2 0h2M7 10h2m2 0h2M7 14h2m2 0h2M9 21v-4h3v4" />
              </>
            )}
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id={`recommendation-${item.id}`}
            className="break-words type-body font-medium text-ink"
          >
            {item.title}
          </h2>
          {item.publisher && (
            <p className="mt-1 break-words type-caption text-secondary">
              {item.publisher}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">{item.type}</Badge>
          {item.isVerified && <Badge variant="success">Verified</Badge>}
          <Badge variant="success" aria-label={`Điểm phù hợp: ${percent}`}>
            Điểm phù hợp: {percent}
          </Badge>
        </div>
      </header>
      <div className="flex flex-wrap gap-x-8 gap-y-4 rounded-compact bg-surface p-4 type-caption text-secondary">
        {item.workFormat && (
          <p>
            Hình thức:{' '}
            <strong className="font-semibold text-ink">
              {item.workFormat}
            </strong>
          </p>
        )}
        {item.location && (
          <p>
            Địa điểm:{' '}
            <strong className="font-semibold text-ink">{item.location}</strong>
          </p>
        )}
        <p>
          Hạn nộp:{' '}
          <strong className="font-semibold text-ink">
            {item.deadline
              ? item.deadline.precision === 'datetime'
                ? deadlineDateTime(
                    item.deadline.instant,
                    item.deadline.sourceTimeZone,
                  )
                : formatOpportunityDate(item.deadline.date)
              : 'Không có hạn nộp'}
          </strong>
        </p>
      </div>
      <footer className="flex justify-end">
        <Link
          to={`/opportunities/${item.id}`}
          aria-label={`Xem chi tiết: ${item.title}`}
          className="inline-flex h-10 items-center gap-2 rounded-control bg-brand px-4 type-label font-medium text-white hover:brightness-95"
        >
          Xem chi tiết <span aria-hidden="true">→</span>
        </Link>
      </footer>
    </Card>
  );
}
