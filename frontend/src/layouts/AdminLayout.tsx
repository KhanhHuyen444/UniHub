import { Link } from 'react-router';
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
};

export function AdminLayout({
  children,
  activeKey = 'dashboard',
  previewNavigation = false,
}: AdminLayoutProps) {
  const area: Extract<ShellArea, 'admin'> = 'admin';
  const { user, logout, status } = useAuth();

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // Local auth is already cleared; LoginPage reports uncertain revocation.
    }
  }

  return (
    <div className="flex min-h-screen bg-page">
      <aside className="sticky top-0 flex h-screen w-[260px] shrink-0 flex-col border-r border-line bg-[linear-gradient(180deg,#E0F2FE_0%,#EBF7FD_50%,#F0F9FF_100%)] shadow-[1px_0_10px_rgba(3,4,94,0.03)]">
        <div className="flex h-[84px] shrink-0 items-center px-5">
          <Brand area={area} previewNavigation={previewNavigation} />
        </div>
        <nav aria-label="Điều hướng quản trị" className="px-4 py-4">
          <ul className="grid gap-1.5">
            {adminNavigation.map((item) => {
              const active = activeKey === item.key;
              return (
                <li key={item.key}>
                  <Link
                    to={navigationTarget(item, area, previewNavigation)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-[46px] items-center gap-3 rounded-compact px-4 py-3 text-sm font-medium leading-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${active ? 'bg-brand text-white shadow-[0_1px_2px_rgba(0,119,182,0.2)]' : 'text-navy hover:bg-white/60'}`}
                  >
                    <img
                      src={icons[item.key]}
                      alt=""
                      width={20}
                      height={20}
                      className={`h-5 w-5 shrink-0 ${active ? 'brightness-0 invert' : item.key === 'dashboard' ? '[filter:brightness(0)_saturate(100%)_invert(8%)_sepia(92%)_saturate(5228%)_hue-rotate(239deg)_brightness(48%)_contrast(115%)]' : ''}`}
                    />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-auto border-t border-line bg-white/60 px-5 py-5 backdrop-blur-sm">
          {previewNavigation ? (
            <>
              <p className="type-label font-medium text-navy">
                Quản trị viên xem trước
              </p>
              <p className="mt-1 type-label text-secondary">Admin preview</p>
            </>
          ) : user ? (
            <>
              <p className="truncate type-label font-medium text-navy">
                {user.fullName}
              </p>
              <p className="mt-1 truncate type-label text-secondary">
                {user.email}
              </p>
            </>
          ) : (
            <p role="status" className="type-label text-secondary">
              {status === 'unavailable'
                ? 'Không kiểm tra được phiên'
                : 'Đang khôi phục phiên…'}
            </p>
          )}
          <div className="mt-3 border-t border-line pt-[10px]">
            <button
              type="button"
              disabled={previewNavigation || !user}
              onClick={() => void handleLogout()}
              className="flex h-5 w-full items-center gap-2 text-left type-label font-medium text-danger disabled:cursor-not-allowed disabled:opacity-60"
            >
              <img
                src={logoutIcon}
                alt=""
                aria-hidden="true"
                width={16}
                height={16}
                className="h-4 w-4 shrink-0"
              />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-8 py-8">
          {children}
        </main>
        <footer className="flex h-[52px] shrink-0 items-center border-t border-line bg-white px-8">
          <p className="mx-auto w-full max-w-[1600px] type-label text-subtle">
            © 2026 UniHub. Bảo lưu mọi quyền.
          </p>
        </footer>
      </div>
    </div>
  );
}
