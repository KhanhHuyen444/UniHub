import { useEffect, useRef, type ReactNode } from 'react';

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
          disabled={busy}
          onClick={onClose}
          className="rounded px-1 text-2xl leading-6 text-muted disabled:opacity-50"
        >
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}
