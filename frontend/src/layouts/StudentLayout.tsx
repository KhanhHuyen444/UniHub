import { StudentAccountMenu } from './StudentAccountMenu';
import { Link } from 'react-router';
import { Button } from '../components/ui/Button';
import notificationIcon from '../assets/notification.svg';
import { Brand } from './Brand';
import { SiteFooter } from './SiteFooter';
import { useAuth } from '../features/auth/AuthProvider';
import {
  navigationTarget,
  studentNavigation,
  type ShellArea,
} from './navigation';

export interface StudentLayoutProps {
  children: React.ReactNode;
  activeKey?: string;
  previewNavigation?: boolean;
}

export function StudentLayout({
  children,
  activeKey = 'recommendations',
  previewNavigation = false,
}: StudentLayoutProps) {
  const area: Extract<ShellArea, 'student'> = 'student';
  const { user, status } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header className="shrink-0 border-b border-line bg-white/95 shadow-nav backdrop-blur-[12px]">
        <div className="mx-auto flex min-h-16 max-w-student flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-8 lg:flex-nowrap lg:py-0">
          <Brand area={area} previewNavigation={previewNavigation} />
          <nav
            aria-label="Điều hướng sinh viên"
            className="order-3 w-full min-w-0 overflow-x-auto lg:order-none lg:w-auto lg:flex-1"
          >
            <ul className="flex items-center justify-between gap-4">
              {studentNavigation.map((item) => (
                <li key={item.key}>
                  <Link
                    to={navigationTarget(item, area, previewNavigation)}
                    aria-current={activeKey === item.key ? 'page' : undefined}
                    className={`type-label inline-flex min-h-7 items-center whitespace-nowrap border-b-2 px-0 pb-1 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${activeKey === item.key ? 'border-brand text-brand' : 'border-transparent text-secondary hover:text-brand'}`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex shrink-0 items-center gap-3">
            <Button
              type="button"
              variant="text"
              size="icon"
              disabled
              aria-label="Thông báo — chỉ là mẫu thiết kế, chưa có chức năng"
            >
              <img
                src={notificationIcon}
                alt=""
                width={16}
                height={20}
                className="h-5 w-4 shrink-0"
              />
            </Button>
            {previewNavigation ? (
              <>
                <div className="hidden text-right xl:block">
                  <p className="type-label font-semibold text-ink">
                    Tài khoản xem trước
                  </p>
                  <p className="type-caption text-muted">Student preview</p>
                </div>
                <span
                  aria-label="Ảnh đại diện mẫu Student"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-cyan text-sm font-bold leading-5 text-navy"
                >
                  SV
                </span>
              </>
            ) : user ? (
              <StudentAccountMenu />
            ) : (
              <span role="status" className="type-caption text-muted">
                {status === 'unavailable' ? 'Phiên chưa sẵn sàng' : 'Đang tải…'}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="w-full flex-1">
        <div className="mx-auto w-full max-w-student px-4 py-8 sm:px-8 sm:pb-20">
          {children}
        </div>
      </main>
      <SiteFooter area={area} previewNavigation={previewNavigation} />
    </div>
  );
}
