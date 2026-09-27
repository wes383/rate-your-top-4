"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { useI18n } from "@/components/providers";
import { METHOD_DOC, type MethodBlock } from "@/lib/method-content";
import { cn } from "@/lib/utils";

/** Renders one documentation block. The union is exhaustive, so an unknown
 *  kind cannot slip through silently. */
function Block({ block }: { block: MethodBlock }) {
  switch (block.kind) {
    case "h3":
      return (
        <h3 className="mt-8 mb-2 font-display text-base font-bold tracking-tight first:mt-4">
          {block.text}
        </h3>
      );
    case "p":
      return <p className="my-3 text-sm leading-7 text-foreground-muted">{block.text}</p>;
    case "formula":
      return (
        <pre className="my-4 overflow-x-auto rounded-lg border border-border bg-hover-bg p-4 font-mono text-[11px] leading-relaxed text-foreground-muted">
          {block.text}
        </pre>
      );
    case "list":
      return (
        <ul className="my-3 flex flex-col gap-2">
          {block.items.map((item) => (
            <li
              key={item}
              className="flex gap-2.5 text-sm leading-7 text-foreground-muted"
            >
              <span
                className="mt-3 h-1 w-1 shrink-0 rounded-full bg-foreground-subtle"
                aria-hidden="true"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case "link":
      return (
        <Link
          href={block.href}
          className="group -ml-2 my-3 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-hover-bg"
        >
          {block.text}
          <ArrowUpRight
            className="h-3.5 w-3.5 text-foreground-subtle transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            aria-hidden="true"
          />
        </Link>
      );
    case "table":
      return (
        <div className="my-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-hover-bg">
                {block.head.map((cell) => (
                  <th
                    key={cell}
                    scope="col"
                    className="px-3 py-2.5 font-medium whitespace-nowrap text-foreground"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr
                  // Rows are a fixed literal from the content module.
                  key={rowIndex}
                  className="border-b border-border last:border-0"
                >
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={cn(
                        "px-3 py-2.5 align-top leading-6 text-foreground-muted",
                        cellIndex === 0 && "font-medium text-foreground"
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return null;
  }
}

export default function MethodPage() {
  const { lang } = useI18n();
  const doc = METHOD_DOC[lang];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <main className="mx-auto w-full max-w-[820px] flex-1 px-6 pt-10 pb-12 lg:px-8">
        <Link
          href="/"
          className="-ml-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-foreground-muted transition-colors hover:bg-hover-bg hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {doc.back}
        </Link>

        <header className="mt-8">
          <h1 className="font-display text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
            {doc.title}
          </h1>
          <p className="mt-4 text-sm leading-7 text-foreground-muted text-pretty">
            {doc.lead}
          </p>
        </header>

        <nav className="mt-8 rounded-lg border border-border p-4" aria-label={doc.toc}>
          <h2 className="mb-2.5 font-mono text-[11px] tracking-wide text-foreground-subtle uppercase">
            {doc.toc}
          </h2>
          <ol className="flex flex-col gap-1">
            {doc.sections.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="flex items-baseline gap-2.5 rounded-md px-2 py-1 text-sm text-foreground-muted transition-colors hover:bg-hover-bg hover:text-foreground"
                >
                  <span className="font-mono text-[11px] text-foreground-faint">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>{section.heading}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article>
          {doc.sections.map((section) => (
            <section key={section.id} id={section.id} className="mt-12 scroll-mt-6">
              <h2 className="border-b border-border pb-2 font-display text-xl font-bold tracking-tight">
                {section.heading}
              </h2>
              <div>
                {section.blocks.map((block, index) => (
                  <Block key={index} block={block} />
                ))}
              </div>
            </section>
          ))}
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
