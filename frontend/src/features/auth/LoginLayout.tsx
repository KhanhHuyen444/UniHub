import { useEffect } from 'react';
import { Link } from 'react-router';
import { Brand } from '../../layouts/Brand';
import { SiteFooter } from '../../layouts/SiteFooter';
import { publicNavigation } from '../../layouts/navigation';
import { LoginIcon } from './LoginIcon';
import './login.css';

export function LoginLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.body.classList.add('unihub-login');
    return () => document.body.classList.remove('unihub-login');
  }, []);
  return (
    <div className="login-shell">
      <header className="login-header">
        <Brand area="public" previewNavigation={false} />
        <nav aria-label="Điều hướng chính">
          <ul>
            {publicNavigation.map((item) => (
              <li key={item.key}>
                <Link to={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <a
          className="login-account"
          href="#login-panel"
          aria-label="Đến khu vực đăng nhập"
        >
          <LoginIcon name="user" />
        </a>
      </header>
      {children}
      <SiteFooter
        area="public"
        navigationLabelOverrides={{
          opportunities: 'Cơ hội',
          roadmaps: 'Lộ trình',
        }}
      />
    </div>
  );
}
