import { Link } from 'react-router';
import { useAuth } from '../features/auth/AuthProvider';
import { UserAvatar } from '../components/ui/UserAvatar';

export function StudentAccountMenu() {
  const { user, logout } = useAuth();
  if (user?.role !== 'Student') return null;
  return (
    <details className="relative shrink-0">
      <summary
        className="flex cursor-pointer list-none items-center gap-2 rounded-control focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        aria-label="Tài khoản sinh viên"
      >
        <span className="hidden max-w-36 truncate text-sm font-semibold text-ink xl:block">
          {user.fullName}
        </span>
        <UserAvatar key={user.id} name={user.fullName} url={user.avatarUrl} />
      </summary>
      <nav
        aria-label="Tài khoản sinh viên"
        className="absolute right-0 z-30 mt-3 grid w-60 gap-1 rounded-card border border-line bg-white p-2 shadow-soft"
      >
        <Link
          className="rounded-control p-3 text-sm hover:bg-surface"
          to="/profile"
          onClick={(e) =>
            e.currentTarget.closest('details')?.removeAttribute('open')
          }
        >
          Hồ sơ cá nhân
        </Link>
        <Link
          className="rounded-control p-3 text-sm hover:bg-surface"
          to="/recommendations"
          onClick={(e) =>
            e.currentTarget.closest('details')?.removeAttribute('open')
          }
        >
          Cơ hội dành cho bạn
        </Link>
        <button
          type="button"
          className="rounded-control p-3 text-left text-sm text-brand hover:bg-surface"
          onClick={() => void logout().catch(() => undefined)}
        >
          Đăng xuất
        </button>
      </nav>
    </details>
  );
}
