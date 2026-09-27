"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { useI18n } from "@/components/providers";

/** Section headings match the method / about pages' top-level h2. */
const SECTION_TITLE = "font-display text-xl font-bold tracking-tight";

/**
 * Privacy page: what the site does and does not store, in plain language.
 * Written against the actual implementation — the two preference cookies,
 * the stateless /api/build call, the third-party hosts a visit touches, and
 * what a share link exposes.
 */
export function PrivacyView() {
  const { t } = useI18n();

  const sections = [
    { title: t("privacy.collectTitle"), body: t("privacy.collect") },
    { title: t("privacy.storageTitle"), body: t("privacy.storage") },
    { title: t("privacy.requestTitle"), body: t("privacy.request") },
    { title: t("privacy.shareTitle"), body: t("privacy.share") },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <main className="mx-auto w-full max-w-[820px] flex-1 px-6 pt-10 pb-12 lg:px-8">
        <Link
          href="/"
          className="-ml-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-foreground-muted transition-colors hover:bg-hover-bg hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {t("privacy.back")}
        </Link>

        <header className="mt-8">
          <h1 className="font-display text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
            {t("privacy.title")}
          </h1>
          <p className="mt-2 text-xs text-foreground-subtle">{t("privacy.updated")}</p>
        </header>

        {sections.map((section) => (
          <section key={section.title} className="mt-10">
            <h2 className={SECTION_TITLE}>{section.title}</h2>
            <p className="mt-3 text-base leading-8 text-foreground-muted text-pretty">
              {section.body}
            </p>
          </section>
        ))}
      </main>

      <SiteFooter />
    </div>
  );
}
