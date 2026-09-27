"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/components/use-hydrated";

/**
 * Accessible modal dialog: portals to <body>, traps Tab focus, closes on Esc
 * or overlay click, and locks background scrolling while open.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  closeLabel = "Close",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg";
  closeLabel?: string;
}) {
  // The portal targets document.body, which only exists on the client.
  const mounted = useHydrated();
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Move focus into the dialog when it opens.
  //
  // `[data-autofocus]` is queried on its own rather than as one selector list:
  // `querySelector` returns the first match in tree order, so
  // `"[data-autofocus], input, button"` would resolve to the close button in
  // the header and the opt-in marker would never win.
  React.useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target =
        panel.querySelector<HTMLElement>("[data-autofocus]") ??
        panel.querySelector<HTMLElement>("input, button");
      target?.focus();
    }, 20);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-modal flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
      <div
        className="fixed inset-0 bg-[var(--overlay-strong)] animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className={cn(
          "relative my-auto w-full animate-scale-in rounded-xl border border-border bg-surface text-foreground shadow-dialog",
          size === "lg" ? "max-w-3xl" : "max-w-xl"
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="font-display text-lg leading-tight font-semibold tracking-tight">
              {title}
            </h2>
            {description && (
              <p className="text-sm text-foreground-muted">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-hover-bg hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-border p-5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
