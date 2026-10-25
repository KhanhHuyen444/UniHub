import { Link } from 'react-router';
import adminLogo from '../assets/logo-admin-36.svg';
import studentLogo from '../assets/logo-student-40.svg';
import { previewTarget, type ShellArea } from './navigation';

export interface BrandProps {
  area: ShellArea;
  previewNavigation: boolean;
}

export function Brand({ area, previewNavigation }: BrandProps) {
  const isAdmin = area === 'admin';
  const logo = isAdmin ? adminLogo : studentLogo;
  const label = area === 'student' ? 'UniHub sinh viên' : 'UniHub';
  const target = previewNavigation
    ? previewTarget(area, area === 'admin' ? 'dashboard' : 'home')
    : '/';

  return (
    <Link
      to={target}
      aria-label={`${label} — Trang chủ`}
      className="inline-flex shrink-0 items-center gap-3 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <img
        aria-hidden="true"
        src={logo}
        width={isAdmin ? 36 : 40}
        height={isAdmin ? 36 : 40}
        className={isAdmin ? 'h-9 w-9' : 'h-10 w-10'}
      />
      <span className="text-2xl font-bold leading-8 text-navy">UniHub</span>
    </Link>
  );
}
