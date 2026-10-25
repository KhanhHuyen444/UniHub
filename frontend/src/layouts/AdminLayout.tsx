import { Link } from 'react-router';
import accountsIcon from '../assets/admin-accounts.svg';
import categoriesIcon from '../assets/admin-categories.svg';
import dashboardIcon from '../assets/admin-dashboard.svg';
import moderationIcon from '../assets/admin-moderation.svg';
import { Brand } from './Brand';
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

  return (
    <div className="flex min-h-screen bg-page">
      <aside className="sticky top-0 flex h-screen w-[260px] shrink-0 flex-col border-r border-line bg-[linear-gradient(180deg,#E0F2FE_0%,#EBF7FD_50%,#F0F9FF_100%)] shadow-[1px_0_10px_rgba(3,4,94,0.03)]">
        <div className="flex h-[84px] shrink-0 items-center px-5">
          <Brand area={area} previewNavigation={previewNavigation} />
        </div>
        <nav aria-label="Điều hướng quản trị" className="px-4">
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
                      className="h-5 w-5 shrink-0"
                    />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-auto border-t border-line bg-white/60 px-5 py-5 backdrop-blur-sm">
          <p className="type-label font-medium text-navy">
            Quản trị viên xem trước
          </p>
          <p className="mt-1 type-label text-secondary">Admin preview</p>
          <div className="mt-3 border-t border-line pt-3">
            <button
              type="button"
              disabled
              className="type-label font-medium text-danger disabled:cursor-not-allowed"
            >
              Đăng xuất (chưa có chức năng)
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
