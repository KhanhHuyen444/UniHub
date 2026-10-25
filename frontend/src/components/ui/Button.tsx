import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant =
  | 'primary'
  | 'outline'
  | 'text'
  | 'neutral'
  | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    'border border-transparent bg-brand text-white shadow-button hover:brightness-95',
  outline: 'border border-brand bg-white text-brand hover:bg-brand/5',
  text: 'border border-transparent bg-transparent text-brand hover:underline',
  neutral: 'border border-line bg-surface text-secondary hover:bg-line/50',
  danger: 'border border-transparent bg-danger text-white hover:brightness-95',
};

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  className = '',
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-control px-4 py-2.5 text-sm font-medium leading-5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:border-transparent disabled:bg-control disabled:text-subtle disabled:shadow-none ${variants[variant]} ${className}`}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
        />
      )}
      {children}
    </button>
  );
}
