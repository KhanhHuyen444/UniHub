import type { SelectHTMLAttributes } from 'react';

export function Select({
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-10 w-full appearance-none rounded-control border border-control bg-white bg-[image:var(--unihub-select-chevron)] bg-[length:16px_16px] bg-[right_12px_center] bg-no-repeat px-3 pr-9 text-sm leading-5 text-ink focus-visible:border-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand aria-[invalid=true]:border-danger aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-danger ${className}`}
    >
      {children}
    </select>
  );
}
