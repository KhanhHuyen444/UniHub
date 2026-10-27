import type { SelectHTMLAttributes } from 'react';

export function Select({
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-10 w-full rounded-control border border-control bg-white px-3 text-sm leading-5 text-ink focus-visible:border-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand aria-[invalid=true]:border-danger aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-danger ${className}`}
    >
      {children}
    </select>
  );
}
