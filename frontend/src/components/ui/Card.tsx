import type { HTMLAttributes } from 'react';

export function Card({
  className = '',
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <section
      {...props}
      className={`rounded-card border border-line bg-white shadow-soft ${className}`}
    />
  );
}
