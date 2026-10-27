import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';

type FieldControlProps = {
  id?: string;
  required?: boolean;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
};

export interface FormFieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function FormField({
  id,
  label,
  hint,
  error,
  required = false,
  className = '',
  children,
}: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const childDescribedBy = isValidElement<FieldControlProps>(children)
    ? children.props['aria-describedby']
    : undefined;
  const describedBy = [childDescribedBy, hintId, errorId]
    .filter(Boolean)
    .join(' ');
  const control = isValidElement<FieldControlProps>(children)
    ? cloneElement(children as ReactElement<FieldControlProps>, {
        id,
        required,
        'aria-describedby': describedBy || undefined,
        'aria-invalid': Boolean(error),
      })
    : children;

  return (
    <div className={`grid ${className || 'gap-2'}`}>
      <label htmlFor={id} className="type-label font-medium text-secondary">
        {label}
        {required && (
          <>
            <span aria-hidden="true" className="ml-1 text-danger">
              *
            </span>
            <span className="sr-only"> (bắt buộc)</span>
          </>
        )}
      </label>
      {control}
      {hint && (
        <p id={hintId} className="type-caption text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          className="type-caption font-medium text-danger"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
