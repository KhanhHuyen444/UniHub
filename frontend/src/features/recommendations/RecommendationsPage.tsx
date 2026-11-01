import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/ui';
import { RecommendationCard } from './RecommendationCard';
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="type-body font-medium text-ink">
            {state.data.items.length} cơ hội phù hợp
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <p className="type-caption text-muted">
              ≡ Sắp xếp theo mức độ phù hợp giảm dần
            </p>
            <Button variant="text" onClick={retry}>
              Tải lại gợi ý
            </Button>
          </div>
        </div>
        <ol className="grid list-none gap-4 p-0" aria-label="Cơ hội được gợi ý">
          {state.data.items.map((item) => (
            <li key={item.id}>
              <article aria-labelledby={`recommendation-${item.id}`}>
                <RecommendationCard item={item} />
              </article>
            </li>
          ))}
        </ol>
      </>
    );
  const showSidebar =
    state.status !== 'unauthenticated' && state.status !== 'forbidden';
  return (
    <section className="grid gap-8" aria-label="Gợi ý cơ hội cá nhân hóa">
      <header>
        <span className="inline-flex items-center gap-2 rounded-pill bg-surface px-3 py-1 type-caption text-navy">
          <span aria-hidden="true" className="text-brand">
            ●
          </span>
          Gợi ý thông minh dựa trên hồ sơ học thuật
        </span>
        <h1 className="mt-3 type-heading text-navy">Cơ hội dành cho bạn</h1>
        <p className="mt-2 type-label text-secondary">
          Khám phá cơ hội phù hợp với chuyên ngành, năm học và kỹ năng của bạn.
        </p>
      </header>
      <div
        className={
          showSidebar
            ? 'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]'
            : 'grid gap-6'
        }
      >
        <div className="grid min-w-0 gap-6">{content}</div>
        {showSidebar && (
          <aside className="grid gap-4" aria-label="Thông tin gợi ý">
            <Card className="grid gap-5 p-5">
              <h3 className="type-body font-medium text-ink">Hồ sơ của bạn</h3>
              <p className="type-label text-muted">
                Cập nhật chuyên ngành, năm học và kỹ năng trong hồ sơ để nhận cơ
                hội phù hợp.
              </p>
              {onCompleteProfile && state.status === 'success' && (
                <Button
                  variant="neutral"
                  className="bg-cyan text-navy"
                  onClick={onCompleteProfile}
                >
                  Cập nhật hồ sơ
                </Button>
              )}
            </Card>
            <section
              className="grid gap-4 rounded-card bg-surface p-5"
              aria-labelledby="recommendation-how"
            >
              <h3
                id="recommendation-how"
                className="type-body font-medium text-navy"
              >
                <span aria-hidden="true" className="mr-2 text-brand">
                  ⓘ
                </span>
                Cách gợi ý hoạt động
              </h3>
              <p className="type-label text-secondary">
                Mức độ phù hợp được tính từ chuyên ngành (40%), năm học (30%) và
                kỹ năng (30%). Chỉ hiển thị cơ hội đạt từ 50% và còn hạn nhận hồ
                sơ hoặc không có hạn nộp.
              </p>
              <div className="rounded-control bg-white p-3">
                <p className="flex justify-between type-caption text-muted">
                  <span>Trọng số tính điểm:</span>
                  <strong className="font-semibold text-ink">
                    100% Tổng điểm
                  </strong>
                </p>
                <div
                  aria-hidden="true"
                  className="my-2 flex h-2 overflow-hidden rounded-pill"
                >
                  <span className="w-2/5 bg-navy" />
                  <span className="w-[30%] bg-brand" />
                  <span className="w-[30%] bg-[#00b4d8]" />
                </div>
                <p className="flex justify-between gap-2 type-caption text-secondary">
                  <span>Ngành 40%</span>
                  <span>Năm 30%</span>
                  <span>Kỹ năng 30%</span>
                </p>
              </div>
              <p className="type-caption italic text-muted">
                Vị trí nghề nghiệp mục tiêu không tham gia tính điểm.
              </p>
            </section>
          </aside>
        )}
      </div>
    </section>
  );
}
