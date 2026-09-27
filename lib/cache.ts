import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Small JSON-backed cache with an in-memory layer in front of a file in
 * `.cache/`. Disk writes are best-effort: a read-only or ephemeral
 * filesystem (serverless) simply degrades to memory-only caching.
 */

const CACHE_DIR = join(process.cwd(), ".cache");

interface Entry<T> {
  value: T;
  expiresAt: number;
}

export interface Cache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
}

export function createCache<T>(namespace: string, ttlMs: number): Cache<T> {
  const memory = new Map<string, Entry<T>>();
  const file = join(CACHE_DIR, `${namespace}.json`);
  let loaded = false;

  const load = () => {
    if (loaded) return;
    loaded = true;
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8")) as Record<
        string,
        Entry<T>
      >;
      const now = Date.now();
      for (const [key, entry] of Object.entries(parsed)) {
        if (entry && entry.expiresAt > now) memory.set(key, entry);
      }
    } catch {
      // No cache file yet, or unreadable: start empty.
    }
  };

  const persist = () => {
    try {
      mkdirSync(dirname(file), { recursive: true });
      const serialisable = Object.fromEntries(memory.entries());
      writeFileSync(file, JSON.stringify(serialisable), "utf8");
    } catch {
      // Ephemeral filesystem: memory cache still applies.
    }
  };

  return {
    get(key) {
      load();
      const entry = memory.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= Date.now()) {
        memory.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key, value) {
      load();
      memory.set(key, { value, expiresAt: Date.now() + ttlMs });
      persist();
    },
  };
}
