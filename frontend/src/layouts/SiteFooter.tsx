import { Link } from 'react-router';
import footerLogo from '../assets/logo-footer-180.png';
import {
  navigationTarget,
  publicNavigation,
  studentNavigation,
  type ShellArea,
} from './navigation';

export interface SiteFooterProps {
  area: Extract<ShellArea, 'public' | 'student'>;
  previewNavigation?: boolean;
}

const supportLabels = ['Điều khoản sử dụng', 'Chính sách bảo mật'];

export function SiteFooter({
  area,
  previewNavigation = false,
}: SiteFooterProps) {
  const links = area === 'student' ? studentNavigation : publicNavigation;

  return (
    <footer className="relative min-h-[301.25px] border-t border-line bg-surface px-8 pb-8 pt-12">
      <div className="mx-auto grid min-h-[220px] max-w-[1216px] grid-cols-[minmax(0,1fr)_280px_280px] gap-8 max-[1400px]:grid-cols-[minmax(0,1fr)_220px_220px]">
        <div className="flex flex-col items-start">
          <img
            src={footerLogo}
            alt=""
            width={180}
            height={180}
            className="h-32 w-32 object-contain"
          />
          <span className="mt-2 text-2xl font-bold leading-8 text-navy">
            UniHub
          </span>
          <p className="type-caption font-semibold text-secondary">
            Kết nối cơ hội, định hướng tương lai.
          </p>
        </div>

        <nav aria-label="Liên kết khám phá">
          <h2 className="type-label font-bold uppercase text-ink">Khám phá</h2>
          <ul className="mt-3 grid gap-2">
            {links.map((item) => (
              <li key={item.key}>
                <Link
                  to={navigationTarget(item, area, previewNavigation)}
                  className="type-label text-muted hover:text-brand focus-visible:rounded-sm"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="type-label font-bold uppercase text-ink">Hỗ trợ</h2>
          <ul className="mt-3 grid gap-2">
            {supportLabels.map((label) => (
              <li key={label}>
                <span className="type-label text-muted" aria-disabled="true">
                  {label}
                </span>
              </li>
            ))}
          </ul>
          {previewNavigation && (
            <p className="mt-3 max-w-56 type-caption text-subtle">
              Đường dẫn dự kiến: /terms và /privacy; nội dung trang đang chờ
              nhóm hoàn thiện.
            </p>
          )}
        </div>
      </div>
      <p className="absolute bottom-4 right-8 mx-auto max-w-[1216px] text-right type-caption text-subtle">
        © 2026 UniHub. Bảo lưu mọi quyền.
      </p>
    </footer>
  );
}
