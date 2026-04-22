import { useEffect, useState } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '../services/firebase';

export type SiteScore = { avg: number; count: number } | null;

/**
 * Reads the aggregated meta for an item (anime / theme / movie / series).
 * Prefers the pre-computed `meta/` node. Falls back to recomputing from
 * `users/` when meta is missing (rare, only for legacy items).
 *
 * Shared between AnimeDetail and MediaDetail to avoid duplicated logic.
 */
export function useSiteScore(
  fbNode: 'ratings' | 'themeRatings' | 'movieRatings' | 'seriesRatings',
  itemId: string | number | null | undefined,
  ratingKeys?: readonly string[],
): SiteScore {
  const [score, setScore] = useState<SiteScore>(null);

  useEffect(() => {
    if (!itemId) { setScore(null); return; }
    let cancelled = false;

    (async () => {
      const metaSnap = await get(ref(db, `${fbNode}/${itemId}/meta`));
      if (cancelled) return;

      if (metaSnap.exists() && metaSnap.val()?.avgOverall != null) {
        const m = metaSnap.val();
        setScore({ avg: m.avgOverall, count: m.count || 0 });
        return;
      }

      // Fallback: compute from users snapshot if ratingKeys provided
      if (!ratingKeys || ratingKeys.length === 0) {
        setScore(null);
        return;
      }

      const usersSnap = await get(ref(db, `${fbNode}/${itemId}/users`));
      if (cancelled) return;
      if (!usersSnap.exists()) { setScore(null); return; }

      const entries = Object.values(usersSnap.val()) as Record<string, number>[];
      const count = entries.length;
      if (count === 0) { setScore(null); return; }

      let total = 0;
      entries.forEach((e) => {
        let sum = 0;
        for (const k of ratingKeys) sum += Number(e[k]) || 0;
        total += sum / ratingKeys.length;
      });
      setScore({ avg: total / count, count });
    })().catch(() => {
      if (!cancelled) setScore(null);
    });

    return () => { cancelled = true; };
  }, [fbNode, itemId, ratingKeys]);

  return score;
}
