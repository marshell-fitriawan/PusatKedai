"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Aksi di bagian bawah (tombol simpan/batal). */
  footer?: ReactNode;
  className?: string;
}

/**
 * Bottom sheet di HP, modal tengah di layar lebar.
 *
 * Memakai elemen <dialog> native supaya focus trap, penguncian scroll latar,
 * dan tombol Esc ditangani browser -- tidak perlu implementasi manual yang
 * biasanya bocor aksesibilitasnya.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      // Esc memicu 'cancel'; state induk harus ikut diperbarui.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      // Klik di area backdrop (di luar panel) menutup dialog.
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "mx-auto mt-auto mb-0 w-full max-w-none bg-transparent p-0",
        "sm:my-auto sm:max-w-md",
        "backdrop:bg-ink/60",
        className,
      )}
    >
      <div
        className={cn(
          "flex max-h-[90dvh] flex-col overflow-hidden border-2 border-ink",
          "bg-surface shadow-brutal-lg",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b-2 border-ink bg-primary p-4">
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="tap-target -m-2 flex items-center justify-center border-2 border-ink bg-surface text-ink shadow-brutal-sm press-brutal"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="overflow-y-auto p-4">{children}</div>

        {footer ? (
          <div className="flex justify-end gap-3 border-t-2 border-ink bg-surface-alt p-4">
            {footer}
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
