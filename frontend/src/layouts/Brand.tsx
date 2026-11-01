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
  const wordmarkBase = isAdmin ? 'text-navy' : 'text-[#1E3A8A]';

  return (
    <Link
      to={target}
      aria-label={`${label} — Trang chủ`}
      className="group inline-flex shrink-0 items-center gap-3 rounded-sm transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <img
        aria-hidden="true"
        src={logo}
        width={isAdmin ? 36 : 40}
        height={isAdmin ? 36 : 40}
        className={`${isAdmin ? 'h-9 w-9' : 'h-10 w-10'} transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3`}
      />
      <span className="text-2xl font-bold leading-8 transition-colors duration-200">
        <span className={wordmarkBase}>Uni</span>
        <span className="text-[#2563EB]">Hub</span>
      </span>
    </Link>
  );
}
