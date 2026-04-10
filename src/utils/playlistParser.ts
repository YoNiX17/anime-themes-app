import type { Anime, AnimeTheme, Video } from '../services/api';
import { searchAnime } from '../services/api';

/* ═══════════════════════════════════════════
   Playlist Parser — Intelligent OP/ED resolver
   ═══════════════════════════════════════════
   Supported formats (all case-insensitive, with typos):
     naruto op 1          — classique
     jjk ed2              — abréviation collée
     aot opening 3        — mot complet
     bleach OP13           — majuscules OK
     frieren op            — sans numéro = séquence 1
     demon slayer - ed 1   — séparateurs ignorés
     csm ending 12         — abréviation + mot complet
     snk s2 op1            — saison ignorée
     Guren no Yumiya       — nom de chanson → recherche directe
     unravel               — nom de chanson → Tokyo Ghoul OP1
     blue bird             — nom de chanson → Naruto Shippuden OP3
   ═══════════════════════════════════════════ */

export interface ParsedLine {
  raw: string;
  animeName: string;
  themeType: 'OP' | 'ED';
  sequence: number;
  isSongSearch?: boolean; // true when input looks like a song name, not anime+OP format
}

export interface ResolvedTheme {
  parsed: ParsedLine;
  status: 'found' | 'approx' | 'not-found';
  anime?: Anime;
  theme?: AnimeTheme;
  video?: Video;
  matchedName?: string;
  songName?: string;
}

// ── Regex patterns for theme type detection ──
const OP_PATTERNS = /\b(op|opening)\s*(\d+)?\b/i;
const ED_PATTERNS = /\b(ed|ending)\s*(\d+)?\b/i;

// Clean separators: dashes, colons, pipes between anime name and theme
const SEPARATORS = /\s*[-–—:|]\s*/g;

// Season patterns to strip (s2, season 3, saison 2, etc.)
const SEASON_PATTERN = /\b(?:s|season|saison)\s*(\d+)\b/gi;

// ── Levenshtein distance for fuzzy name matching ──
function levenshtein(a: string, b: string): number {
  const la = a.length, lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;
  const dp: number[][] = Array.from({ length: la + 1 }, (_, i) =>
    Array.from({ length: lb + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[la][lb];
}

/**
 * Score how well an anime name matches the query (0 = perfect, higher = worse)
 */
function nameMatchScore(query: string, animeName: string): number {
  const q = query.toLowerCase();
  const name = animeName.toLowerCase();
  // Exact match
  if (q === name) return 0;
  // Name starts with query
  if (name.startsWith(q)) return 1;
  // Name contains query as substring
  if (name.includes(q)) return 2;
  // Levenshtein distance (normalized)
  const dist = levenshtein(q, name);
  const maxLen = Math.max(q.length, name.length);
  const ratio = dist / maxLen;
  if (ratio < 0.3) return 3 + ratio * 10;
  return 10 + ratio * 10;
}

/**
 * Parse a single raw line into structured data.
 * Very permissive — handles all kinds of sloppy input.
 */
export function parseLine(raw: string): ParsedLine | null {
  const line = raw.trim();
  if (!line || line.startsWith('#') || line.startsWith('//')) return null;

  // Normalize common typos
  let normalized = line
    .replace(/opning/gi, 'opening')
    .replace(/openning/gi, 'opening')
    .replace(/oppening/gi, 'opening')
    .replace(/opneing/gi, 'opening')
    .replace(/edning/gi, 'ending')
    .replace(/eding/gi, 'ending')
    .replace(/endding/gi, 'ending')
    .replace(/endig/gi, 'ending')
    .replace(/endin\b/gi, 'ending')
    // "o.p" "e.d" → "op" "ed"
    .replace(/\bo\.?\s*p\.?\b/gi, 'op')
    .replace(/\be\.?\s*d\.?\b/gi, 'ed');

  let themeType: 'OP' | 'ED' = 'OP';
  let sequence = 1;
  let animeName = normalized;

  // Try to extract OP/ED pattern
  const opMatch = normalized.match(OP_PATTERNS);
  const edMatch = normalized.match(ED_PATTERNS);

  const hasThemeIndicator = !!(opMatch || edMatch);

  if (edMatch) {
    themeType = 'ED';
    sequence = edMatch[2] ? parseInt(edMatch[2], 10) : 1;
    animeName = normalized.replace(ED_PATTERNS, '');
  } else if (opMatch) {
    themeType = 'OP';
    sequence = opMatch[2] ? parseInt(opMatch[2], 10) : 1;
    animeName = normalized.replace(OP_PATTERNS, '');
  }

  // Strip season info (kept for later but not used in name)
  animeName = animeName.replace(SEASON_PATTERN, '');

  // Clean up anime name: remove separators at edges, extra spaces
  animeName = animeName
    .replace(SEPARATORS, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!animeName) return null;

  return {
    raw: line,
    animeName,
    themeType,
    sequence,
    isSongSearch: !hasThemeIndicator,
  };
}

/**
 * Parse a full text block (multi-line) into parsed entries.
 */
export function parseText(text: string): ParsedLine[] {
  const raw = text
    .split(/[\n;]+/)
    .map(s => s.trim())
    .filter(Boolean);

  const results: ParsedLine[] = [];
  for (const line of raw) {
    const parsed = parseLine(line);
    if (parsed) results.push(parsed);
  }
  return results;
}

/**
 * Find the best matching theme from an anime's theme list.
 */
function findTheme(anime: Anime, type: 'OP' | 'ED', seq: number): AnimeTheme | undefined {
  const themes = anime.animethemes || [];

  // Exact match: same type and sequence
  const exact = themes.find(
    t => t.type === type && (t.sequence || 1) === seq
  );
  if (exact) return exact;

  // Fallback: same type, any sequence (closest number)
  const sameType = themes
    .filter(t => t.type === type)
    .sort((a, b) => Math.abs((a.sequence || 1) - seq) - Math.abs((b.sequence || 1) - seq));
  if (sameType.length > 0) return sameType[0];

  // Last resort: first theme of any type
  return themes[0];
}

/**
 * Get the best video from a theme.
 */
function getBestVideo(theme: AnimeTheme): Video | undefined {
  const entry = theme.animethemeentries?.[0];
  if (!entry?.videos?.length) return undefined;
  return [...entry.videos].sort((a, b) => (b.resolution || 0) - (a.resolution || 0))[0];
}

const AT_BASE = 'https://api.animethemes.moe';

/**
 * Search AnimeThemes for a song name directly.
 * Returns matching themes with anime context.
 */
async function searchBySongName(songName: string): Promise<ResolvedTheme | null> {
  try {
    const res = await fetch(
      `${AT_BASE}/search?q=${encodeURIComponent(songName)}&fields[search]=animethemes&include[animetheme]=anime.images,animethemeentries.videos`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const themes = data?.search?.animethemes as Array<{
      id: number; slug: string; type: string; sequence: number;
      anime: Anime;
      song?: { title?: string };
      animethemeentries: Array<{ videos: Video[] }>;
    }>;
    if (!themes?.length) return null;

    // Find the best matching theme (prioritize TV anime over movies/specials)
    const best = themes[0];
    const anime: Anime = {
      ...best.anime,
      animethemes: [{ id: best.id, slug: best.slug, type: best.type, sequence: best.sequence, animethemeentries: best.animethemeentries as AnimeTheme['animethemeentries'] }],
    };

    const theme: AnimeTheme = {
      id: best.id,
      slug: best.slug,
      type: best.type,
      sequence: best.sequence,
      animethemeentries: best.animethemeentries as AnimeTheme['animethemeentries'],
    };
    const video = getBestVideo(theme);

    return {
      parsed: { raw: songName, animeName: songName, themeType: (best.type as 'OP' | 'ED') || 'OP', sequence: best.sequence || 1, isSongSearch: true },
      status: 'found',
      anime,
      theme,
      video,
      matchedName: best.anime.name,
      songName: best.song?.title,
    };
  } catch {
    return null;
  }
}

/**
 * Resolve a single line: tries anime name search, then song name search.
 * Uses Levenshtein scoring to pick the best anime match.
 */
export async function resolveLine(parsed: ParsedLine): Promise<ResolvedTheme> {
  try {
    // Strategy 1: If it looks like a song name (no OP/ED indicator), try song search first
    if (parsed.isSongSearch) {
      const songResult = await searchBySongName(parsed.animeName);
      if (songResult) {
        songResult.parsed = parsed;
        return songResult;
      }
    }

    // Strategy 2: Standard anime name search (with abbreviations + Jikan fuzzy)
    const results = await searchAnime(parsed.animeName);

    if (!results.length) {
      // Strategy 3: Last resort — try song name search even for OP/ED format
      if (!parsed.isSongSearch) {
        const songResult = await searchBySongName(parsed.raw);
        if (songResult) {
          songResult.parsed = parsed;
          return songResult;
        }
      }
      return { parsed, status: 'not-found' };
    }

    // Sort results by name similarity to the query
    const scored = results.map(a => ({
      anime: a,
      score: nameMatchScore(parsed.animeName, a.name),
    }));
    scored.sort((a, b) => a.score - b.score);

    // Try multiple results — find the first one with a matching theme
    for (const { anime } of scored.slice(0, 5)) {
      const theme = findTheme(anime, parsed.themeType, parsed.sequence);
      if (theme && theme.type === parsed.themeType) {
        const video = getBestVideo(theme);
        const isExact = (theme.sequence || 1) === parsed.sequence;
        return {
          parsed,
          status: isExact ? 'found' : 'approx',
          anime,
          theme,
          video,
          matchedName: anime.name,
        };
      }
    }

    // Fallback: use the best-scored anime, any theme
    const best = scored[0].anime;
    const theme = findTheme(best, parsed.themeType, parsed.sequence);
    if (!theme) {
      return { parsed, status: 'approx', anime: best, matchedName: best.name };
    }

    const video = getBestVideo(theme);
    return {
      parsed,
      status: 'approx',
      anime: best,
      theme,
      video,
      matchedName: best.name,
    };
  } catch {
    return { parsed, status: 'not-found' };
  }
}

/**
 * Resolve all lines with concurrency=2 and batching.
 */
export async function resolveAll(
  lines: ParsedLine[],
  onProgress?: (idx: number, result: ResolvedTheme) => void,
): Promise<ResolvedTheme[]> {
  const results: ResolvedTheme[] = new Array(lines.length);
  const BATCH_SIZE = 2;

  for (let i = 0; i < lines.length; i += BATCH_SIZE) {
    const batch = lines.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map((line, j) =>
        resolveLine(line).then(r => {
          const idx = i + j;
          results[idx] = r;
          onProgress?.(idx, r);
          return r;
        })
      )
    );
    if (i + BATCH_SIZE < lines.length) {
      await new Promise(r => setTimeout(r, 400));
    }
  }

  return results;
}

/**
 * Search anime and return all their themes for the search-to-add feature.
 * Returns anime objects with full theme lists.
 */
export async function searchAnimesWithThemes(query: string): Promise<Anime[]> {
  if (!query.trim()) return [];
  return searchAnime(query.trim().slice(0, 200));
}
