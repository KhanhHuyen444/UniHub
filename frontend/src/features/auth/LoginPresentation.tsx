import type { ReactNode } from 'react';
import { Link } from 'react-router';
import logo from '../../assets/logo-student-40.svg';
import shield from '../../assets/admin-moderation.svg';
import { LoginIcon } from './LoginIcon';

const benefits = [
  {
    icon: 'graduate',
    title: 'Khám phá cơ hội phù hợp',
    text: 'Tìm thực tập, việc làm và học bổng đã được duyệt trên UniHub.',
  },
  {
    icon: 'trend',
    title: 'Định hướng kỹ năng',
    text: 'Lộ trình kỹ năng theo từng giai đoạn năm học vững chắc.',
  },
  {
    icon: 'calendar',
    title: 'Quản lý lịch và deadline',
    text: 'Theo dõi lịch và các mốc thời gian quan trọng của bạn.',
  },
] as const;
export function LoginPresentation({
  googleButton,
  submitting = false,
  restoring = false,
  error,
  authError,
}: {
  googleButton: ReactNode;
  submitting?: boolean;
  restoring?: boolean;
  error?: string | null;
  authError?: string | null;
}) {
  return (
    <main className="login-main">
      <div className="login-columns">
        <section className="login-introduction" aria-labelledby="login-welcome">
          <p className="login-eyebrow">
            <img src={shield} width="14" height="14" alt="" />
            Cổng thông tin hướng nghiệp &amp; cơ hội sinh viên
          </p>
          <h1 id="login-welcome">
            Chào mừng đến với{' '}
            <span>
              Uni<span>Hub</span>
            </span>
          </h1>
          <p className="login-description">
            Khám phá cơ hội thực tập, việc làm, học bổng và định hướng nghề
            nghiệp dành cho sinh viên Việt Nam.
          </p>
          <ul className="login-benefits">
            {benefits.map((item) => (
              <li key={item.icon}>
                <span className="login-benefit-icon">
                  <LoginIcon name={item.icon} />
                </span>
                <div>
                  <h2>{item.title}</h2>
                  <p>{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section
          id="login-panel"
          className="login-panel"
          tabIndex={-1}
          aria-labelledby="login-title"
        >
          <div className="login-brand">
            <img src={logo} width="144" height="144" alt="" />
            <p>
              Uni<span>Hub</span>
            </p>
            <span className="login-brand-dot" aria-hidden="true" />
            <p className="login-slogan">KIẾN THỨC MỞ LỐI TƯƠNG LAI</p>
          </div>
          <h2 id="login-title">Đăng nhập UniHub</h2>
          <div className="login-google">{googleButton}</div>
          {restoring ? (
            <p className="login-notice" role="status">
              Đang khôi phục phiên đăng nhập…
            </p>
          ) : null}
          {submitting ? (
            <p className="login-notice" role="status" aria-live="polite">
              Đang xác minh tài khoản…
            </p>
          ) : null}
          {error ? (
            <p className="login-notice login-error" role="alert">
              {error}
            </p>
          ) : null}
          {authError ? (
            <p className="login-notice login-error" role="status">
              {authError}
            </p>
          ) : null}
          <aside
            className="login-privacy"
            aria-label="Bảo mật và quyền riêng tư"
          >
            <h3>
              <LoginIcon name="lock" />
              Bảo mật &amp; Quyền riêng tư
            </h3>
            <p>
              UniHub dùng mã định danh Google, email, họ tên và ảnh đại diện để
              tạo hoặc cập nhật tài khoản khi đăng nhập.
            </p>
          </aside>
          <Link className="login-home" to="/">
            <LoginIcon name="arrow" />
            Quay về trang chủ
          </Link>
        </section>
      </div>
    </main>
  );
}
