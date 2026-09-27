"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Copy } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import type { Lang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";
import { useI18n } from "@/components/providers";

type Status = "copied" | "failed" | null;

/**
 * Copy-paste prompt page.
 *
 * The prompt itself is rendered as raw markdown inside a `<pre>`: it is a
 * payload to be copied verbatim, not a document to be read formatted, and its
 * tables only line up in a monospace face.
 */
export function PromptView({ prompts }: { prompts: Record<Lang, string> }) {
  const { t, lang } = useI18n();
  const [status, setStatus] = React.useState<Status>(null);

  const text = prompts[lang] || prompts.zh || prompts.en;
  const missing = text.length === 0;

  // Transient feedback clears itself so a second press starts clean.
  React.useEffect(() => {
    if (status === null) return;
    const timer = window.setTimeout(() => setStatus(null), 2400);
    return () => window.clearTimeout(timer);
  }, [status]);

  const handleCopy = async () => {
    setStatus((await copyText(text)) ? "copied" : "failed");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <main className="mx-auto w-full max-w-[820px] flex-1 px-6 pt-10 pb-12 lg:px-8">
        <Link
          href="/"
          className="-ml-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-foreground-muted transition-colors hover:bg-hover-bg hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {t("prompt.back")}
        </Link>

        <header className="mt-8">
          <h1 className="font-display text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
            {t("prompt.title")}
          </h1>
          <p className="mt-4 text-sm leading-7 text-foreground-muted text-pretty">
            {t("prompt.lead")}
          </p>
        </header>

        <section className="mt-10">
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-hover-bg px-3 py-2.5">
              <span className="font-mono text-[11px] tracking-wide text-foreground-subtle uppercase">
                {t("prompt.fileLabel")}
                {!missing && (
                  <span className="ml-2 normal-case">
                    {t("prompt.chars", { n: text.length })}
                  </span>
                )}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleCopy()}
                disabled={missing}
              >
                {status === "copied" ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {status === "copied"
                  ? t("prompt.copied")
                  : status === "failed"
                    ? t("prompt.failed")
                    : t("prompt.copy")}
              </Button>
            </div>
            <pre className="max-h-[560px] overflow-auto bg-surface p-4 font-mono text-[11px] leading-relaxed whitespace-pre text-foreground-muted">
              {text}
            </pre>
          </div>
        </section>

        <section className="mt-10 flex flex-col gap-2.5 border-t border-border pt-8">
          <Link
            href="/"
            className="group flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3.5 transition-colors hover:bg-hover-bg"
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">
                {t("prompt.gotoRater")}
              </span>
              <span className="text-xs text-foreground-subtle">
                {t("prompt.gotoRaterHint")}
              </span>
            </span>
            <ArrowRight
              className="h-4 w-4 shrink-0 text-foreground-subtle transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
          <Link
            href="/method"
            className="group flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3.5 transition-colors hover:bg-hover-bg"
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">
                {t("prompt.gotoMethod")}
              </span>
              <span className="text-xs text-foreground-subtle">
                {t("prompt.gotoMethodHint")}
              </span>
            </span>
            <ArrowRight
              className="h-4 w-4 shrink-0 text-foreground-subtle transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
