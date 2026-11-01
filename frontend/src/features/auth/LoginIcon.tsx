import type { ReactNode } from 'react';

// Small outline UI symbols; the UniHub logo is always the existing SVG asset.
export function LoginIcon({
  name,
}: {
  name: 'user' | 'graduate' | 'trend' | 'calendar' | 'lock' | 'arrow';
}) {
  const paths: Record<typeof name, ReactNode> = {
    user: (
      <>
        <circle cx="12" cy="8" r="3" />
        <path d="M5 20v-2a7 7 0 0 1 14 0v2Z" />
      </>
    ),
    graduate: (
      <>
        <path d="m2 9 10-5 10 5-10 5Z" />
        <path d="M6 11v6l6 3 6-3v-6M22 9v8" />
      </>
    ),
    trend: (
      <>
        <path d="m3 17 7-7 4 4 7-8M15 6h6v6" />
      </>
    ),
    calendar: (
      <>
        <rect x="4" y="5" width="16" height="16" rx="1" />
        <path d="M8 3v4m8-4v4M4 10h16M8 14h1m3 0h1m3 0h1M8 17h1m3 0h1" />
      </>
    ),
    lock: (
      <>
        <rect x="6" y="10" width="12" height="11" rx="2" />
        <path d="M9 10V6a3 3 0 0 1 6 0v4M12 14v3" />
      </>
    ),
    arrow: <path d="m12 5-7 7 7 7M5 12h14" />,
  };
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
