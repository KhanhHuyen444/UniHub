import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { useAuth } from './AuthProvider';
import { UserAvatar } from './UserAvatar';

export function StudentAccountMenu() {
  const { user, logout } = useAuth();
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (
        detailsRef.current &&
        !detailsRef.current.contains(event.target as Node)
      ) {
        detailsRef.current.removeAttribute('open');
      }
    }

    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, []);

  if (user?.role !== 'Student') return null;

  function closeMenu() {
    if (detailsRef.current) {
      detailsRef.current.removeAttribute('open');
    }
  }

  return (
    <details
      ref={detailsRef}
      className="relative shrink-0"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          closeMenu();
        }
      }}
    >
      <summary
        className="flex cursor-pointer list-none items-center gap-2 rounded-control p-1 hover:bg-surface/80 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden"
        aria-label="Tài khoản sinh viên"
      >
        <span className="hidden max-w-36 truncate text-sm font-semibold text-ink xl:block">
          {user.fullName}
        </span>
        <UserAvatar key={user.id} name={user.fullName} url={user.avatarUrl} />
        <svg
          className="h-3.5 w-3.5 text-secondary transition-transform"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m19.5 8.25-7.5 7.5-7.5-7.5"
          />
        </svg>
      </summary>
      <nav
        aria-label="Tài khoản sinh viên"
        className="absolute right-0 z-30 mt-2 grid w-64 gap-1 rounded-card border border-line bg-white p-2 shadow-public-card"
      >
        <div className="border-b border-line px-3 py-2">
          <p className="truncate text-sm font-bold text-ink">{user.fullName}</p>
          <p className="truncate text-xs text-muted">{user.email}</p>
        </div>
        <Link
          className="flex items-center gap-2.5 rounded-control px-3 py-2 text-sm font-medium text-ink hover:bg-surface hover:text-brand transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          to="/profile"
          onClick={closeMenu}
        >
          <svg
            className="h-4 w-4 text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
            />
          </svg>
          Hồ sơ cá nhân
        </Link>
        <Link
          className="flex items-center gap-2.5 rounded-control px-3 py-2 text-sm font-medium text-ink hover:bg-surface hover:text-brand transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          to="/recommendations"
          onClick={closeMenu}
        >
          <svg
            className="h-4 w-4 text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
            />
          </svg>
          Cơ hội dành cho bạn
        </Link>
        <div className="border-t border-line my-1" />
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-control px-3 py-2 text-left text-sm font-medium text-danger hover:bg-danger-surface transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-danger"
          onClick={() => void logout().catch(() => undefined)}
        >
          <svg
            className="h-4 w-4 text-danger"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
            />
          </svg>
          Đăng xuất
        </button>
      </nav>
    </details>
  );
}
