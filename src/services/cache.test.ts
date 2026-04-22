import { describe, it, expect, beforeEach } from 'vitest';
import { memoFetch, memoGet, memoSet, memoClear } from './cache';

describe('cache', () => {
  beforeEach(() => memoClear());

  it('stores and retrieves values', () => {
    memoSet('k', 42);
    expect(memoGet<number>('k')).toBe(42);
  });

  it('expires entries after TTL', async () => {
    memoSet('k', 1, 10);
    await new Promise((r) => setTimeout(r, 20));
    expect(memoGet('k')).toBeUndefined();
  });

  it('deduplicates in-flight requests', async () => {
    let calls = 0;
    const loader = () =>
      new Promise<number>((r) => setTimeout(() => { calls++; r(123); }, 10));
    const [a, b] = await Promise.all([
      memoFetch('k', loader),
      memoFetch('k', loader),
    ]);
    expect(a).toBe(123);
    expect(b).toBe(123);
    expect(calls).toBe(1);
  });

  it('does not cache on loader error', async () => {
    await expect(
      memoFetch('k', () => Promise.reject(new Error('nope'))),
    ).rejects.toThrow();
    expect(memoGet('k')).toBeUndefined();
  });
});
