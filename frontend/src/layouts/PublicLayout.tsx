import { Link } from 'react-router';
import { Brand } from './Brand';
import { SiteFooter } from './SiteFooter';
import {
  navigationTarget,
  publicNavigation,
  type ShellArea,
} from './navigation';

export interface PublicLayoutProps {
  children: React.ReactNode;
  activeKey?: string;
  previewNavigation?: boolean;
}

export function PublicLayout({
  children,
  activeKey = 'home',
  previewNavigation = false,
}: PublicLayoutProps) {
  const area: Extract<ShellArea, 'public'> = 'public';

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header className="h-[72px] shrink-0 border-b border-line bg-white/90 shadow-nav backdrop-blur-[24px]">
        <div className="mx-auto flex h-full max-w-public items-center justify-between px-8">
          <Brand area={area} previewNavigation={previewNavigation} />
          <nav aria-label="Điều hướng chính">
            <ul className="flex items-center gap-8">
              {publicNavigation.map((item) => (
                <li key={item.key}>
                  <Link
                    to={navigationTarget(item, area, previewNavigation)}
                    aria-current={activeKey === item.key ? 'page' : undefined}
                    className={`type-label inline-flex min-h-7 items-center border-b pb-1 font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${activeKey === item.key ? 'border-brand text-brand' : 'border-transparent text-secondary hover:text-brand'}`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <span
            aria-label="Đăng nhập với Google — chỉ là mẫu thiết kế, chưa có chức năng"
            aria-disabled="true"
            className="inline-flex h-12 w-[270px] shrink-0 items-center justify-center gap-3 rounded-control border border-control bg-white px-4 text-sm font-medium leading-5 text-secondary shadow-soft"
          >
            <span aria-hidden="true" className="font-bold text-[#4285F4]">
              G
            </span>
            Đăng nhập với Google
          </span>
        </div>
      </header>

      <main className="w-full flex-1">
        <div className="mx-auto w-full max-w-public px-8 py-6">{children}</div>
      </main>
      <SiteFooter area={area} previewNavigation={previewNavigation} />
    </div>
  );
}
