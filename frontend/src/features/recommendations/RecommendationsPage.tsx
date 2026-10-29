import { Link } from 'react-router';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/ui';
import { formatOpportunityDate } from '../opportunities/contracts';
import {
  useRecommendations,
  type RecommendationsRole,
} from './useRecommendations';
export interface RecommendationsPageProps {
  accessToken: string | null;
  role: RecommendationsRole;
  onCompleteProfile?: () => void;
  onSignIn?: () => void;
}
export function RecommendationsPage({
  accessToken,
  role,
  onCompleteProfile,
  onSignIn,
}: RecommendationsPageProps) {
  const { state, retry } = useRecommendations(accessToken, role);
  const signIn = onSignIn ? (
    <Button onClick={onSignIn}>Đăng nhập</Button>
  ) : undefined;
  let content;
  if (state.status === 'unauthenticated')
    content = (
      <ErrorState
        title="Cần đăng nhập Student"
        description="Đăng nhập để xem cơ hội phù hợp với hồ sơ của bạn."
      >
        {signIn}
      </ErrorState>
    );
  else if (state.status === 'forbidden')
    content = (
      <ErrorState
        title="Không có quyền xem gợi ý"
        description="Gợi ý cá nhân hóa chỉ dành cho Student."
      />
    );
  else if (state.status === 'loading')
    content = <LoadingState title="Đang tải cơ hội phù hợp" />;
  else if (state.status === 'empty')
    content = (
      <EmptyState
        title="Chưa có cơ hội phù hợp"
        description="Hiện chưa có cơ hội đạt ngưỡng phù hợp với hồ sơ của bạn. Bạn có thể cập nhật hồ sơ hoặc thử lại sau."
      >
        {onCompleteProfile && (
          <Button onClick={onCompleteProfile}>Cập nhật hồ sơ</Button>
        )}
        <Button variant="outline" onClick={retry}>
          Thử lại
        </Button>
      </EmptyState>
    );
  else if (state.status === 'error') {
    if (state.httpStatus === 409 && state.code === 'PROFILE_INCOMPLETE')
      content = (
        <ErrorState
          title="Cần hoàn thiện hồ sơ"
          description="Bổ sung chuyên ngành, năm học từ 1 đến 4 và ít nhất một kỹ năng trong Hồ sơ, sau đó tải lại gợi ý."
          onRetry={retry}
        >
          {onCompleteProfile && (
            <Button onClick={onCompleteProfile}>Hoàn thiện hồ sơ</Button>
          )}
        </ErrorState>
      );
    else if (state.httpStatus === 401)
      content = (
        <ErrorState
          title="Phiên đăng nhập không hợp lệ"
          description="Phiên đã hết hạn hoặc không còn hiệu lực. Vui lòng đăng nhập lại."
          onRetry={retry}
        >
          {signIn}
        </ErrorState>
      );
    else if (state.httpStatus === 403)
      content = (
        <ErrorState
          title="Không có quyền xem gợi ý"
          description="Tài khoản hiện tại không có quyền Student để xem gợi ý."
        />
      );
    else
      content = (
        <ErrorState
          title="Không tải được gợi ý"
          description={`Vui lòng thử lại. Mã lỗi: ${state.code}`}
          onRetry={retry}
        />
      );
  } else if (state.status === 'success')
    content = (
      <>
        <Button variant="outline" onClick={retry}>
          Tải lại gợi ý
        </Button>
        <ol
          className="grid list-none gap-4 p-0 md:grid-cols-2"
          aria-label="Cơ hội được gợi ý"
        >
          {state.data.items.map((item) => (
            <li key={item.id}>
              <Card className="h-full p-5">
                <article
                  className="grid gap-3"
                  aria-labelledby={`recommendation-${item.id}`}
                >
                  <div className="flex gap-2">
                    <Badge variant="info">{item.type}</Badge>
                    {item.isVerified && (
                      <Badge variant="success">Verified</Badge>
                    )}
                  </div>
                  <h2
                    id={`recommendation-${item.id}`}
                    className="type-title font-semibold text-navy"
                  >
                    {item.title}
                  </h2>
                  {item.publisher && (
                    <p className="type-label text-secondary">
                      {item.publisher}
                    </p>
                  )}
                  <p className="type-label font-semibold text-brand">
                    Điểm phù hợp:{' '}
                    {new Intl.NumberFormat('vi-VN', {
                      style: 'percent',
                      maximumFractionDigits: 2,
                    }).format(item.matchScore)}
                  </p>
                  {item.workFormat && (
                    <p className="type-label">Hình thức: {item.workFormat}</p>
                  )}
                  {item.location && (
                    <p className="type-label">Địa điểm: {item.location}</p>
                  )}
                  <p className="type-label">
                    Hạn nộp:{' '}
                    {item.deadline
                      ? formatOpportunityDate(item.deadline.date)
                      : 'Không có hạn nộp'}
                  </p>
                  <Link
                    to={`/opportunities/${item.id}`}
                    className="type-label font-semibold text-brand underline"
                    aria-label={`Xem chi tiết: ${item.title}`}
                  >
                    Xem chi tiết
                  </Link>
                </article>
              </Card>
            </li>
          ))}
        </ol>
      </>
    );
  return (
    <section className="grid gap-5" aria-label="Gợi ý cơ hội cá nhân hóa">
      <h1 className="type-title font-semibold text-navy">
        Cơ hội dành cho bạn
      </h1>
      {content}
    </section>
  );
}
