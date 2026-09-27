"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { useI18n } from "@/components/providers";
import { dict } from "@/lib/i18n";

const TMDB_HOME = "https://www.themoviedb.org/";
const TMDB_LOGO = "/tmdb-logo.svg";
const JANGODISC = "https://www.youtube.com/@JangoDisc";

/** Section headings match the method page's top-level h2 so the two long-form
 *  pages read at the same scale. */
const SECTION_TITLE = "font-display text-xl font-bold tracking-tight";

const BODY_TEXT = "text-base leading-8 text-foreground-muted text-pretty";

/**
 * About page: why the site exists (the six schools of Top 4), the blind spot
 * it fills, and the stance its algorithm actually takes. The attribution logo
 * is kept in `public/` rather than hotlinked so the page renders without a
 * third-party request.
 */
export function AboutView() {
  const { lang } = useI18n();
  const a = dict[lang].about;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <main className="mx-auto w-full max-w-[820px] flex-1 px-6 pt-10 pb-12 lg:px-8">
        <Link
          href="/"
          className="-ml-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-foreground-muted transition-colors hover:bg-hover-bg hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {a.back}
        </Link>

        <header className="mt-8">
          <h1 className="font-display text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
            {a.title}
          </h1>
        </header>

        <section className="mt-10">
          <h2 className={SECTION_TITLE}>{a.whyTitle}</h2>
          <p className={`mt-3 ${BODY_TEXT}`}>{a.why}</p>
          <ol className="mt-4 list-decimal space-y-3 pl-6">
            {a.schools.map((school) => (
              <li key={school.name} className={BODY_TEXT}>
                <strong className="font-semibold text-foreground">
                  {school.name}
                </strong>{" "}
                {school.lines.join(" ")}
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-10">
          <h2 className={SECTION_TITLE}>{a.blindSpotTitle}</h2>
          <p className={`mt-3 ${BODY_TEXT}`}>{a.blindSpot}</p>
        </section>

        <section className="mt-10">
          <h2 className={SECTION_TITLE}>{a.stanceTitle}</h2>
          <ul className="mt-3 list-disc space-y-3 pl-6">
            {a.stance.map((line) => (
              <li key={line} className={BODY_TEXT}>
                {line}
              </li>
            ))}
          </ul>
          <p className={`mt-4 ${BODY_TEXT}`}>{a.closing}</p>
        </section>

        <section className="mt-10">
          <h2 className={SECTION_TITLE}>{a.inspiredBy}</h2>
          <a
            href={JANGODISC}
            target="_blank"
            rel="noreferrer"
            aria-label={a.inspiredByLink}
            className="group -ml-2 mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-hover-bg"
          >
            JangoDisc
            <ArrowUpRight
              className="h-3.5 w-3.5 text-foreground-subtle transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              aria-hidden="true"
            />
          </a>
        </section>

        <section className="mt-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
            <a
              href={TMDB_HOME}
              target="_blank"
              rel="noreferrer"
              aria-label={a.tmdbLink}
              className="inline-flex w-fit shrink-0 items-center rounded-md transition-opacity hover:opacity-80"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- the optimizer rejects SVG sources unless dangerouslyAllowSVG is set */}
              <img src={TMDB_LOGO} alt="TMDB" width={33} height={24} className="h-6 w-auto" />
            </a>
            <p className="text-sm leading-6 text-foreground-subtle">{a.tmdb}</p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
