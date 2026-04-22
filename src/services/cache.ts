/**
 * Simple in-memory TTL cache with request deduplication.
 *
 * Goals:
 *  - Avoid refetching the same remote resource on every navigation.
 *  - Coalesce concurrent calls for the same key into a single request
 *    (so 3 components asking for the same anime detail = 1 network call).
 *
 * Usage:
 *   const data = await memoFetch('jikan:anime:12345', () => fetchJikanAnimeDetail(12345));
 */

type Entry<T> = {
  value: T;
  expiresAt: number;
};

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export function memoGet<T>(key: string): T | undefined {
  const entry = store.get(key) as Entry<T> | undefined;
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

export function memoSet<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Fetch-with-cache helper. Deduplicates concurrent calls for the same key.
 * If the loader throws, the error is propagated and nothing is cached.
 */
export async function memoFetch<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  const cached = memoGet<T>(key);
  if (cached !== undefined) return cached;

  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const p = (async () => {
    try {
      const value = await loader();
      memoSet(key, value, ttlMs);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}

/** Clear everything. Useful for tests. */
export function memoClear(): void {
  store.clear();
  inflight.clear();
}
