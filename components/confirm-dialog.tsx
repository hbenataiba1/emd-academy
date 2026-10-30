'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red button, for something that deletes. */
  danger?: boolean;
};

/**
 * A confirmation inside the page, instead of the browser's own pop-up.
 * `const { confirm, dialog } = useConfirm();` then `if (!(await confirm({ title: '...' }))) return;`
 * and render `{dialog}` somewhere in the component.
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback(
    (next: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setOptions(next);
      }),
    [],
  );

  const close = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  }, []);

  useEffect(() => {
    if (!options) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options, close]);

  const dialog = options ? (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close(false);
      }}
    >
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-md rounded-2xl bg-white p-6 text-[#191625] shadow-2xl">
        <h2 id="confirm-title" className="text-lg font-black">
          {options.title}
        </h2>
        {options.message ? <p className="mt-2 text-sm leading-6 text-[#5f5872]">{options.message}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => close(false)}
            className="h-10 rounded-xl border border-[#d9d1ee] bg-white px-5 text-sm font-bold text-[#302945] transition hover:bg-[#f8f6ff]"
          >
            {options.cancelLabel || 'Cancel'}
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => close(true)}
            className={`h-10 rounded-xl px-5 text-sm font-black text-white transition ${
              options.danger ? 'bg-[#dc2626] hover:bg-[#b91c1c]' : 'bg-[#7c3aed] hover:bg-[#6d31dc]'
            }`}
          >
            {options.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, dialog };
}
