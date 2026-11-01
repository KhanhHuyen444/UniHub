type IconName = 'account' | 'academic' | 'info' | 'lock' | 'check' | 'sparkles';

const paths: Record<IconName, React.ReactNode> = {
  account: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="9" r="3" />
      <path d="M6.5 19v-2a5.5 5.5 0 0 1 11 0v2" />
    </>
  ),
  academic: (
    <>
      <path d="m2 8 10-5 10 5-10 5-10-5Zm4 2v7l6 3 6-3v-7M22 8v8" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7v1" />
    </>
  ),
  lock: (
    <>
      <rect x="6" y="10" width="12" height="11" rx="2" />
      <path d="M9 10V6a3 3 0 0 1 6 0v4M12 14v3" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  sparkles: (
    <>
      <path d="m10 3 2.5 6.5L19 12l-6.5 2.5L10 21l-2.5-6.5L1 12l6.5-2.5L10 3ZM19 2v6M16 5h6M20 16v5M17.5 18.5h5" />
    </>
  ),
};

export function ProfileIcon({
  name,
  className = 'h-5 w-5',
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      {paths[name]}
    </svg>
  );
}
