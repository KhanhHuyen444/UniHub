import { Link } from 'react-router';
import { NotificationBell } from '../features/notifications/NotificationBell';
import { StudentAccountMenu } from '../features/profile/StudentAccountMenu';
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
  const initials = user?.fullName
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part.slice(0, 1))
    .join('')
    .toLocaleUpperCase('vi-VN');

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header className="h-16 shrink-0 border-b border-line bg-white/95 shadow-nav backdrop-blur-[12px]">
        <div className="mx-auto flex h-full max-w-student items-center gap-8 px-8">
          <Brand area={area} previewNavigation={previewNavigation} />
          <nav aria-label="Điều hướng sinh viên" className="min-w-0 flex-1">
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
            <NotificationBell
              key={user?.id ?? 'guest'}
              preview={previewNavigation}
            />
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
              user.role === 'Student' ? (
                <StudentAccountMenu />
              ) : (
                <>
                  <div className="hidden max-w-44 text-right xl:block">
                    <p className="truncate type-label font-semibold text-ink">
                      {user.fullName}
                    </p>
                    <p className="truncate type-caption text-muted">
                      {user.email}
                    </p>
                  </div>
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={`Ảnh đại diện của ${user.fullName}`}
                      className="h-9 w-9 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      aria-label={`Ảnh đại diện của ${user.fullName}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-cyan text-sm font-bold leading-5 text-navy"
                    >
                      {initials || 'U'}
                    </span>
                  )}
                </>
              )
            ) : (
              <span role="status" className="type-caption text-muted">
                {status === 'unavailable' ? 'Phiên chưa sẵn sàng' : 'Đang tải…'}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="w-full flex-1">
        <div className="mx-auto w-full max-w-student px-8 py-10">
          {children}
        </div>
      </main>
      <SiteFooter area={area} previewNavigation={previewNavigation} />
    </div>
  );
}
