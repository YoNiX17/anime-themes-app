import { ref, get, set } from 'firebase/database';
import { db } from '../services/firebase';

const ANIME_KEYS = ['plot', 'characters', 'animation', 'ost', 'pacing'];
const THEME_KEYS = ['music', 'animation'];

function computeAverages(entries: Record<string, number>[], keys: string[]) {
  const cnt = entries.length;
  if (cnt === 0) return { avgOverall: 0, count: 0, averages: {} };
  const totals: Record<string, number> = Object.fromEntries(keys.map(k => [k, 0]));
  entries.forEach(e => { keys.forEach(k => { totals[k] += e[k] || 0; }); });
  const avgs: Record<string, number> = Object.fromEntries(
    keys.map(k => [k, Math.round((totals[k] / cnt) * 10) / 10])
  );
  const avgOverall = Math.round(
    keys.reduce((s, k) => s + avgs[k], 0) / keys.length * 10
  ) / 10;
  return { avgOverall, count: cnt, averages: avgs };
}

export async function refreshAnimeRatingMeta(
  animeId: string | number,
  extraMeta?: Record<string, unknown>,
): Promise<void> {
  const metaSnap = await get(ref(db, `ratings/${animeId}/meta`));
  const existing = metaSnap.exists() ? metaSnap.val() : {};
  const usersSnap = await get(ref(db, `ratings/${animeId}/users`));
  const entries = usersSnap.exists()
    ? (Object.values(usersSnap.val()) as Record<string, number>[])
    : [];
  const agg = computeAverages(entries, ANIME_KEYS);
  await set(ref(db, `ratings/${animeId}/meta`), { ...existing, ...extraMeta, ...agg });
}

export async function refreshThemeRatingMeta(
  themeId: string | number,
  extraMeta?: Record<string, unknown>,
): Promise<void> {
  const metaSnap = await get(ref(db, `themeRatings/${themeId}/meta`));
  const existing = metaSnap.exists() ? metaSnap.val() : {};
  const usersSnap = await get(ref(db, `themeRatings/${themeId}/users`));
  const entries = usersSnap.exists()
    ? (Object.values(usersSnap.val()) as Record<string, number>[])
    : [];
  const agg = computeAverages(entries, THEME_KEYS);
  await set(ref(db, `themeRatings/${themeId}/meta`), { ...existing, ...extraMeta, ...agg });
}
