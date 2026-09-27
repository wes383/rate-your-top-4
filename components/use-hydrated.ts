"use client";

import * as React from "react";

/** The store never changes, so nothing needs to be torn down. */
function subscribe(): () => void {
  return () => {};
}

/** Server snapshot: nothing is hydrated while rendering on the server. */
function getServerSnapshot(): boolean {
  return false;
}

/**
 * `false` while server-rendered (and during the hydration render), `true`
 * afterwards.
 *
 * Replaces the `useEffect(() => setMounted(true), [])` idiom: reading a
 * client-only value through `useSyncExternalStore` yields the same two-phase
 * result without a state update inside an effect body.
 */
export function useHydrated(): boolean {
  return React.useSyncExternalStore(subscribe, () => true, getServerSnapshot);
}
