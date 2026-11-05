import { Link, useNavigate } from 'react-router';
import accountsIcon from '../assets/admin-accounts.svg';
import categoriesIcon from '../assets/admin-categories.svg';
import dashboardIcon from '../assets/admin-dashboard.svg';
import moderationIcon from '../assets/admin-moderation.svg';
import logoutIcon from '../assets/logout-icon.png';
import { Brand } from './Brand';
import { useAuth } from '../features/auth/AuthProvider';
import {
  adminNavigation,
  navigationTarget,
  type ShellArea,
} from './navigation';

export interface AdminLayoutProps {
  children: React.ReactNode;
  activeKey?: string;
  previewNavigation?: boolean;
}

const icons: Record<string, string> = {
  dashboard: dashboardIcon,
  moderation: moderationIcon,
  categories: categoriesIcon,
  users: accountsIcon,
  'opportunity-moderation': moderationIcon,
  'forum-moderation': moderationIcon,
};

export function AdminLayout({
  children,
  activeKey = 'dashboard',
  previewNavigation = false,
}: AdminLayoutProps) {
  const area: Extract<ShellArea, 'admin'> = 'admin';
  const { user, logout, status } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // Local auth is already cleared; LoginPage reports uncertain revocation.
    } finally {
      navigate('/login', { replace: true });
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50/70">
      <aside className="sticky top-0 flex h-screen w-[268px] shrink-0 flex-col border-r border-line bg-gradient-to-b from-[#EBF5FE] via-[#F4F9FD] to-[#FFFFFF] shadow-[1px_0_12px_rgba(3,4,94,0.04)]">
        <div className="flex h-[84px] shrink-0 items-center justify-between border-b border-line/60 px-5 bg-white/40 backdrop-blur-sm">
          <Brand area={area} previewNavigation={previewNavigation} />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100/80 px-2 py-0.5 text-[11px] font-semibold text-brand tracking-wide">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Admin
          </span>
        </div>
        <nav aria-label="Điều hướng quản trị" className="px-3.5 py-4">
          <ul className="grid gap-1.5">
            {adminNavigation.map((item) => {
              const active = activeKey === item.key;
              return (
                <li key={item.key}>
                  <Link
                    to={navigationTarget(item, area, previewNavigation)}
                    aria-current={active ? 'page' : undefined}
                    className={`group flex min-h-[46px] items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium leading-5 transition-all duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                      active
                        ? 'bg-gradient-to-r from-brand to-[#0284C7] text-white shadow-[0_3px_10px_rgba(0,119,182,0.28)] translate-x-1 font-semibold'
                        : 'text-navy hover:bg-white/90 hover:text-brand hover:translate-x-1 hover:shadow-sm'
                    }`}
                  >
                    <img
                      src={icons[item.key]}
                      alt=""
                      width={20}
                      height={20}
                      className={`h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                        active
                          ? 'brightness-0 invert'
                          : item.key === 'dashboard'
                            ? '[filter:brightness(0)_saturate(100%)_invert(8%)_sepia(92%)_saturate(5228%)_hue-rotate(239deg)_brightness(48%)_contrast(115%)]'
                            : ''
                      }`}
                    />
                    <span className="transition-colors duration-200">
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-auto border-t border-line/70 bg-white/70 p-4 backdrop-blur-md transition-colors duration-200 hover:bg-white/90 shadow-sm">
          {previewNavigation ? (
            <>
              <p className="type-label font-medium text-navy">
                Quản trị viên xem trước
              </p>
              <p className="mt-1 type-label text-secondary">Admin preview</p>
            </>
          ) : user ? (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-brand to-sky-400 text-xs font-bold text-white shadow-soft">
                {user.fullName
                  .trim()
                  .split(/\s+/)
                  .slice(-2)
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-navy">
                  {user.fullName}
                </p>
                <p className="truncate text-[11px] text-secondary">
                  {user.email}
                </p>
              </div>
            </div>
          ) : (
            <p role="status" className="type-label text-secondary">
              {status === 'unavailable'
                ? 'Không kiểm tra được phiên'
                : 'Đang khôi phục phiên…'}
            </p>
          )}
          <div className="mt-3 border-t border-line/60 pt-2.5">
            <button
              type="button"
              disabled={previewNavigation || !user}
              onClick={() => void handleLogout()}
              className="group flex h-8 w-full items-center gap-2 rounded-md px-2 text-left type-label font-medium text-danger transition-all duration-200 hover:bg-red-50 hover:translate-x-0.5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <img
                src={logoutIcon}
                alt=""
                aria-hidden="true"
                width={16}
                height={16}
                className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6"
              />
              <span className="transition-colors duration-200">Đăng xuất</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-[radial-gradient(ellipse_80%_60%_at_50%_-15%,rgba(14,165,233,0.05),rgba(255,255,255,0))]">
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-8 py-8">
          {children}
        </main>
        <footer className="flex h-[52px] shrink-0 items-center border-t border-line bg-white/80 px-8 backdrop-blur-sm">
          <p className="mx-auto w-full max-w-[1600px] type-label text-subtle">
            © 2026 UniHub. Bảo lưu mọi quyền.
          </p>
        </footer>
      </div>
    </div>
  );
}
