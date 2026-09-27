/**
 * Client-side TMDB image fallback through the wsrv.nl image proxy.
 *
 * Some networks (fake-IP proxies, regional blocks, transient CDN hiccups)
 * cannot reach `image.tmdb.org` even though everything else works. Every TMDB
 * image therefore gets one proxy retry, and the page keeps a session counter
 * of direct failures: once more than two images have failed, every subsequent
 * image skips the doomed direct attempt and loads through the proxy from the
 * start.
 *
 * "Session" means this page load: the counter is module state, so it resets on
 * reload and is not shared across tabs. Import from client code only — the
 * counter is meaningless on the server.
 */

const IMAGE_PROXY_BASE = "https://wsrv.nl/?url=";

/** Direct TMDB image failures observed since this page loaded. */
let directFailures = 0;

/** Wrap an image URL in the wsrv.nl proxy (the original URL is encoded). */
export function proxiedImageUrl(url: string): string {
  return `${IMAGE_PROXY_BASE}${encodeURIComponent(url)}`;
}

/** Record one direct (non-proxied) TMDB image failure for this session. */
export function reportImageFailure(): void {
  directFailures += 1;
}

/**
 * True once more than two images have failed directly in this session —
 * subsequent images start on the proxy instead of trying TMDB first.
 */
export function shouldUseImageProxy(): boolean {
  return directFailures > 2;
}
