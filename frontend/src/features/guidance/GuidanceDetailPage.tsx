import { useCallback } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { PublicLayout } from '../../layouts/PublicLayout';
import { Badge, Card, ErrorState, LoadingState } from '../../components/ui';
import { ApiError } from '../../lib/api';
import { getGuidanceDetail } from './api';
import { isGuidanceId } from './contracts';
import { useGuidanceRequest } from './useGuidanceRequest';

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
  return (
    <PublicLayout activeKey="roadmaps">
      <div className="grid gap-6">
        <Link className="text-brand underline" to={returnTo}>
          Quay lại lộ trình
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
        {item && (
          <>
            <Card className="grid gap-3 p-6">
              <h1 className="type-heading text-navy break-words">
                {item.title}
              </h1>
              <p className="type-label text-secondary">
                Đơn vị đăng: {item.publisher ?? 'Chưa có thông tin'}
              </p>
            </Card>
            {[
              ['Nội dung', item.descriptionText],
              ['Yêu cầu', item.requirementsText],
            ].map(([title, text]) => (
              <Card key={title} className="grid gap-3 p-6">
                <h2 className="type-title text-navy">{title}</h2>
                <p className="whitespace-pre-wrap break-words type-body text-secondary">
                  {text ?? 'Chưa có thông tin'}
                </p>
              </Card>
            ))}
            {[
              { label: 'Chuyên ngành', links: item.majors },
              { label: 'Kỹ năng', links: item.skills },
            ].map(({ label, links }) => (
              <Card key={label} className="grid gap-3 p-6">
                <h2 className="type-title text-navy">{label}</h2>
                {links.length === 0 ? (
                  <p>Chưa có thông tin</p>
                ) : (
                  <ul className="flex flex-wrap gap-2" aria-label={label}>
                    {links.map((link) => (
                      <li key={link.id}>
                        <Badge
                          variant={
                            link.status === 'Closed' ? 'warning' : 'neutral'
                          }
                        >
                          {link.name}
                          {link.status === 'Closed' ? ' (Đã đóng)' : ''}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ))}
            <Card className="grid gap-3 p-6">
              <h2 className="type-title text-navy">Năm học</h2>
              {item.academicYears.length === 0 ? (
                <p>Bài viết chưa gắn năm học.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {item.academicYears.map((year) => (
                    <li key={year}>
                      <Badge>Năm {year}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>
    </PublicLayout>
  );
}
