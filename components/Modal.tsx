"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";

/* ------------------------------------------------------------------ *
 *  Modal — a single, accessible dialog shell used across the app.
 *  Handles: portal, Esc to close, backdrop click, body scroll-lock,
 *  focus trap, and returning focus to the trigger on close.
 * ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
  closeOnBackdrop = true,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  closeOnBackdrop?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreFocus.current = document.activeElement as HTMLElement | null;

    // Lock background scroll while the dialog is up.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus into the dialog.
    const t = window.setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(
        'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])',
      );
      (first ?? panelRef.current)?.focus();
    }, 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Tab") {
        trapTab(e, panelRef.current);
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreFocus.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const maxW = size === "sm" ? "26rem" : size === "lg" ? "44rem" : "32rem";

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="modal-panel"
        style={{ maxWidth: maxW }}
      >
        {(title || subtitle) && (
          <div className="modal-header">
            <div>
              {title && <h2 className="text-base font-bold">{title}</h2>}
              {subtitle && (
                <p className="mt-0.5 text-sm" style={{ color: "var(--text-2)" }}>
                  {subtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              className="modal-close"
              onClick={onClose}
              aria-label="დახურვა"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

function trapTab(e: KeyboardEvent, root: HTMLElement | null) {
  if (!root) return;
  const nodes = root.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
  if (nodes.length === 0) return;
  const list = Array.from(nodes).filter((n) => n.offsetParent !== null);
  if (list.length === 0) return;
  const first = list[0];
  const last = list[list.length - 1];
  const active = document.activeElement as HTMLElement;
  if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

/* ------------------------------------------------------------------ *
 *  useConfirm — an imperative replacement for window.confirm() that
 *  renders as a branded modal. Wrap the app once in <ConfirmProvider>.
 *
 *      const confirm = useConfirm();
 *      if (await confirm({ title: "წავშალო?", tone: "danger" })) { ... }
 * ------------------------------------------------------------------ */

type ConfirmOptions = {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
};

const ConfirmContext = createContext<
  ((opts: ConfirmOptions) => Promise<boolean>) | null
>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setState(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setState(null);
  }, []);

  const tone = state?.tone ?? "danger";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={state !== null}
        onClose={() => settle(false)}
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => settle(false)}>
              {state?.cancelLabel ?? "გაუქმება"}
            </button>
            <button
              className={`btn ${tone === "danger" ? "btn-danger" : "btn-primary"}`}
              onClick={() => settle(true)}
            >
              {state?.confirmLabel ?? "დადასტურება"}
            </button>
          </>
        }
      >
        <div className="flex gap-3.5">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: tone === "danger" ? "var(--red-soft)" : "var(--primary-soft)",
              color: tone === "danger" ? "var(--red)" : "var(--primary)",
            }}
          >
            <AlertTriangle size={20} />
          </span>
          <div className="pt-0.5">
            <h3 className="text-[0.95rem] font-bold">{state?.title}</h3>
            {state?.message && (
              <p className="mt-1 text-sm" style={{ color: "var(--text-2)" }}>
                {state.message}
              </p>
            )}
          </div>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within <ConfirmProvider>");
  return ctx;
}
