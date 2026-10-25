import type { HTMLAttributes } from 'react';

export type BadgeVariant = 'info' | 'success' | 'warning' | 'neutral' | 'error';

const variants: Record<BadgeVariant, string> = {
  info: 'bg-info-surface text-info',
  success: 'bg-success-surface text-success',
  warning: 'bg-warning-surface text-warning',
  neutral: 'bg-surface text-secondary',
  error: 'bg-danger-surface text-danger',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({
  variant = 'neutral',
  className = '',
  ...props
}: BadgeProps) {
  return (
    <span
      {...props}
      className={`inline-flex min-h-5 items-center rounded-pill px-2 py-0.5 text-xs font-semibold leading-4 ${variants[variant]} ${className}`}
    />
  );
}
