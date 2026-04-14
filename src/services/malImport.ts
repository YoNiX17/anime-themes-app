import { ref, set, get } from 'firebase/database';
import { db } from '../services/firebase';
import { searchAnime } from './api';
import { getAnimeName, groupByFranchise } from '../utils/animeGrouping';

export interface MALEntry {
  malId: number;
  title: string;
  type: string;
  score: number; // 0-10
  status: string;
  episodes: number;
  watchedEpisodes: number;
}

export interface ImportProgress {
  current: number;
  total: number;
  currentTitle: string;
  added: number;
  skipped: number;
  errors: string[];
}

/**
 * Parse a MyAnimeList XML export file into structured entries.
 */
export function parseMALXml(xmlText: string): MALEntry[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const animeNodes = doc.querySelectorAll('anime');
  const entries: MALEntry[] = [];

  animeNodes.forEach(node => {
    const getText = (tag: string) => node.querySelector(tag)?.textContent?.trim() || '';
    const malId = parseInt(getText('series_animedb_id'), 10);
    const title = getText('series_title');
    const type = getText('series_type');
    const score = parseInt(getText('my_score'), 10) || 0;
    const status = getText('my_status');
    const episodes = parseInt(getText('series_episodes'), 10) || 0;
    const watchedEpisodes = parseInt(getText('my_watched_episodes'), 10) || 0;

    if (malId && title) {
      entries.push({ malId, title, type, score, status, episodes, watchedEpisodes });
    }
  });

  return entries;
}

/**
 * Convert a MAL score (1-10) to our 0-100 scale.
 */
function malScoreTo100(malScore: number): number {
  if (malScore <= 0) return 0;
  return Math.round(malScore * 10);
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Import MAL entries into the user's profile.
 * For each MAL entry:
 *  1. Get the franchise name via getAnimeName()
 *  2. Search AnimeThemes for that franchise to find ALL seasons
 *  3. Add all seasons to the user's profile
 *  4. If MAL score > 0, apply converted score to all 5 categories
 */
export async function importMALToProfile(
  uid: string,
  entries: MALEntry[],
  onProgress: (progress: ImportProgress) => void,
): Promise<ImportProgress> {
  // Deduplicate by franchise: only process each franchise once
  const franchiseMap = new Map<string, MALEntry>();
  for (const entry of entries) {
    if (entry.status === 'Plan to Watch') continue;
    const franchise = getAnimeName(entry.title);
    const existing = franchiseMap.get(franchise);
    // Keep entry with highest score for this franchise
    if (!existing || entry.score > existing.score) {
      franchiseMap.set(franchise, entry);
    }
  }

  const franchises = Array.from(franchiseMap.entries());
  const progress: ImportProgress = {
    current: 0,
    total: franchises.length,
    currentTitle: '',
    added: 0,
    skipped: 0,
    errors: [],
  };

  for (const [franchise, malEntry] of franchises) {
    progress.current++;
    progress.currentTitle = franchise;
    onProgress({ ...progress });

    try {
      // Search AnimeThemes for this franchise
      let results = await searchAnime(franchise);
      if (results.length === 0) {
        // Fallback: try original MAL title
        results = await searchAnime(malEntry.title);
        if (results.length === 0) {
          progress.errors.push(franchise);
          continue;
        }
      }

      // Group results by franchise and find matching group
      const groups = groupByFranchise(results);
      const matchingGroup = groups.find(g => g.franchise.toLowerCase() === franchise.toLowerCase())
        || groups[0];

      if (!matchingGroup) {
        progress.errors.push(franchise);
        continue;
      }

      const score100 = malScoreTo100(malEntry.score);
      const isRated = malEntry.score > 0;

      // Add each season to the user's profile
      for (const anime of matchingGroup.seasons) {
        const existingSnap = await get(ref(db, `users/${uid}/ratings/${anime.id}`));
        if (existingSnap.exists()) {
          progress.skipped++;
          continue;
        }

        const largeCover = anime.images?.find(img => img.facet === 'Large Cover')?.link;
        const smallCover = anime.images?.find(img => img.facet === 'Small Cover')?.link;
        const cover = largeCover || smallCover || '';
        const franchiseName = getAnimeName(anime.name);

        const saveData: Record<string, unknown> = {
          animeName: anime.name,
          franchise: franchiseName,
          timestamp: Date.now(),
          rated: isRated,
        };

        if (isRated) {
          saveData.plot = score100;
          saveData.characters = score100;
          saveData.animation = score100;
          saveData.ost = score100;
          saveData.pacing = score100;
        }

        if (cover) saveData.coverImage = cover;

        await set(ref(db, `users/${uid}/ratings/${anime.id}`), saveData);
        progress.added++;
      }

      // Rate-limit between franchises
      await delay(300);
    } catch {
      progress.errors.push(franchise);
    }
  }

  progress.currentTitle = '';
  onProgress({ ...progress });
  return progress;
}
