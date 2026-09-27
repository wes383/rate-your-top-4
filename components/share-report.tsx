"use client";

import * as React from "react";
import { AlertCircle, Check, Download, Link2, Share2 } from "lucide-react";
import type { BuildResult } from "@/lib/types";
import { copyText } from "@/lib/clipboard";
import { renderShareCard } from "@/lib/share-card";
import { formatScore } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/providers";

type Status = "copied" | "rendering" | "failed" | null;

/**
 * Share actions for a finished report.
 *
 * "Copy link" copies the deep link for the same four films (`?m=id,id,id,id`),
 * rebuilt from the resolved movies rather than read off `location` so it stays
 * correct even if the address bar was edited.
 *
 * The downloaded image is stamped with the bare home page instead — the card
 * outlives the build it describes, so a deep link to one particular Top 4 would
 * be misleading once the URL is pasted somewhere else.
 */
export function ShareReport({ result }: { result: BuildResult }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [status, setStatus] = React.useState<Status>(null);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Transient feedback clears itself so a reopened menu starts clean.
  React.useEffect(() => {
    if (status === null || status === "rendering") return;
    const timer = window.setTimeout(() => setStatus(null), 2400);
    return () => window.clearTimeout(timer);
  }, [status]);

  const buildShareUrl = () => {
    const ids = result.movies.map((movie) => movie.tmdbId).join(",");
    const url = new URL(window.location.href);
    url.search = ids ? `?m=${ids}` : "";
    url.hash = "";
    return url.toString();
  };

  /** The home page with no query string — what the share image links back to. */
  const buildPageUrl = () => {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    return url.toString();
  };

  const handleCopyLink = async () => {
    setStatus((await copyText(buildShareUrl())) ? "copied" : "failed");
  };

  const handleDownload = async () => {
    setStatus("rendering");
    try {
      const blob = await renderShareCard({ result, lang, t, url: buildPageUrl() });
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `top4-${formatScore(result.build.total, 1)}-${result.build.tier}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Revoke late: Safari aborts the download if the blob URL dies too early.
      window.setTimeout(() => URL.revokeObjectURL(href), 10_000);
      setStatus(null);
      setOpen(false);
    } catch {
      setStatus("failed");
    }
  };

  const message =
    status === "copied" ? t("share.copied") : status === "failed" ? t("share.failed") : null;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <Share2 className="h-4 w-4" aria-hidden="true" />
        {t("share.button")}
      </Button>

      {open && (
        <div className="absolute right-0 z-dropdown mt-2 w-56 rounded-lg border border-border bg-surface p-1.5 shadow-pop">
          <MenuItem
            icon={<Link2 className="h-4 w-4" aria-hidden="true" />}
            label={t("share.link")}
            onClick={() => void handleCopyLink()}
          />
          <MenuItem
            icon={<Download className="h-4 w-4" aria-hidden="true" />}
            label={status === "rendering" ? t("share.rendering") : t("share.image")}
            onClick={() => void handleDownload()}
            disabled={status === "rendering"}
          />
          {message && (
            <p className="flex items-center gap-1.5 px-2.5 pt-1.5 pb-1 text-xs text-foreground-subtle">
              {status === "copied" ? (
                <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              )}
              {message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition-colors duration-base hover:bg-hover-bg disabled:pointer-events-none disabled:opacity-50"
    >
      {icon}
      {label}
    </button>
  );
}
