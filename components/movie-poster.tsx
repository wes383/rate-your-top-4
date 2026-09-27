"use client";

import * as React from "react";
import Image from "next/image";
import { Film } from "lucide-react";
import { posterUrl } from "@/lib/media";
import {
  proxiedImageUrl,
  reportImageFailure,
  shouldUseImageProxy,
} from "@/lib/image-proxy";
import { cn } from "@/lib/utils";

/**
 * One loading attempt for a poster. `proxied` marks the wsrv.nl retry after
 * the direct TMDB fetch failed; `null` means both attempts failed and the
 * typographic fallback should show.
 */
type Attempt = { original: string; proxied: boolean } | null;

/**
 * 2:3 poster with a typographic fallback. TMDB posters are served through
 * `next/image`, so `remotePatterns` in next.config.ts must allow the host.
 *
 * A poster that fails to load retries once through the wsrv.nl proxy, and
 * after more than two direct failures in one page session every poster skips
 * the direct attempt entirely (see `lib/image-proxy.ts`).
 */
export function MoviePoster({
  posterPath,
  title,
  size = "w342",
  className,
  priority = false,
}: {
  posterPath: string | null;
  title: string;
  size?: "w185" | "w342" | "w500";
  className?: string;
  priority?: boolean;
}) {
  const original = posterUrl(posterPath, size);
  const initial = title.trim().charAt(0) || "?";

  // Attempt state resets when the film under the slot changes (slot components
  // are reused when the user swaps a film), so the replacement's poster gets a
  // fresh try. Adjusting state during render is the React-blessed way to keep
  // derived state in sync with props without reaching for an effect.
  const [attempt, setAttempt] = React.useState<Attempt>(() =>
    original ? { original, proxied: shouldUseImageProxy() } : null
  );
  const [prevOriginal, setPrevOriginal] = React.useState(original);
  if (prevOriginal !== original) {
    setPrevOriginal(original);
    setAttempt(original ? { original, proxied: shouldUseImageProxy() } : null);
  }

  const handleError = () => {
    if (!attempt) return;
    if (attempt.proxied) {
      // The proxy failed too — give up and show the fallback.
      setAttempt(null);
      return;
    }
    // A direct failure counts toward the session threshold, and this poster
    // meanwhile retries once through the proxy.
    reportImageFailure();
    setAttempt({ original: attempt.original, proxied: true });
  };

  return (
    <div
      className={cn(
        "relative aspect-[2/3] w-full overflow-hidden rounded-md bg-hover-bg",
        className
      )}
    >
      {attempt ? (
        attempt.proxied ? (
          /* eslint-disable-next-line @next/next/no-img-element -- the proxied
             image must load in the browser itself (that is the point: this
             network cannot reach TMDB), so it bypasses the server-side optimizer */
          <img
            src={proxiedImageUrl(attempt.original)}
            alt={title}
            className="absolute inset-0 h-full w-full object-cover"
            onError={handleError}
          />
        ) : (
          <Image
            src={attempt.original}
            alt={title}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 260px"
            priority={priority}
            className="object-cover"
            onError={handleError}
          />
        )
      ) : (
        <div className="poster-fallback flex h-full w-full flex-col items-center justify-center gap-2 px-3 text-center">
          <Film className="h-6 w-6 text-foreground-faint" aria-hidden="true" />
          <span className="font-display text-2xl leading-none font-bold text-foreground-subtle">
            {initial}
          </span>
          <span className="line-clamp-2 text-xs text-foreground-subtle">{title}</span>
        </div>
      )}
    </div>
  );
}
