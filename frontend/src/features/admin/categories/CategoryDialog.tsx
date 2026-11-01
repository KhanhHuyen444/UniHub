import { useEffect, useRef, type ReactNode } from 'react';

function CloseIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/** Native modal owns focus trapping, Escape and return-focus without another UI dependency. */
export function CategoryDialog({
  title,
  busy,
  onClose,
  children,
  returnFocus,
}: {
  title: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
  returnFocus: HTMLElement | null;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    node?.querySelector<HTMLElement>('input, textarea')?.focus();
    return () => {
      node?.close();
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, [returnFocus]);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="category-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto w-[480px] max-w-[calc(100%-32px)] rounded-card bg-white p-6 text-ink shadow-xl backdrop:bg-[#0f172a]/50"
    >
      <header className="mb-5 flex items-center justify-between gap-4 border-b border-line pb-4">
        <h2 id="category-dialog-title" className="type-heading text-ink">
          {title}
        </h2>
        <button
          type="button"
          aria-label="Đóng hộp thoại"
          title="Đóng hộp thoại"
          disabled={busy}
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-control text-secondary hover:bg-surface hover:text-navy hover:scale-110 active:scale-95 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 disabled:scale-100"
        >
          <CloseIcon className="h-4 w-4" />
          <span className="sr-only">Đóng hộp thoại</span>
        </button>
      </header>
      {children}
    </dialog>
  );
}
