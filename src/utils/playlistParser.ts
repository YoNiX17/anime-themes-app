import type { Anime, AnimeTheme, Video } from '../services/api';
import { searchAnime } from '../services/api';

/* ═══════════════════════════════════════════
   Playlist Parser — Intelligent OP/ED resolver
   ═══════════════════════════════════════════
   Supported formats (all case-insensitive, with typos handled):
     naruto op 1
     jjk ed2
     aot opening 3
     bleach OP13
     demon slayer ed 1
     frieren op          (default: sequence 1)
     chainsaw man ending 12
     one piece - op 4
     snk s2 op1
     Naruto Shippuden OP 16
     blue lock ending2
   ═══════════════════════════════════════════ */

export interface ParsedLine {
  raw: string;
  animeName: string;
  themeType: 'OP' | 'ED';
  sequence: number;
}

export interface ResolvedTheme {
  parsed: ParsedLine;
  status: 'found' | 'approx' | 'not-found';
  anime?: Anime;
  theme?: AnimeTheme;
  video?: Video;
  matchedName?: string;
}

// ── Regex patterns for theme type detection ──
const OP_PATTERNS = /\b(op|opening)\s*(\d+)?\b/i;
const ED_PATTERNS = /\b(ed|ending)\s*(\d+)?\b/i;

// Clean separators: dashes, colons, pipes between anime name and theme
const SEPARATORS = /\s*[-–—:|]\s*/g;

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

  // Try to extract OP pattern
  const opMatch = normalized.match(OP_PATTERNS);
  const edMatch = normalized.match(ED_PATTERNS);

  if (edMatch) {
    themeType = 'ED';
    sequence = edMatch[2] ? parseInt(edMatch[2], 10) : 1;
    animeName = normalized.replace(ED_PATTERNS, '');
  } else if (opMatch) {
    themeType = 'OP';
    sequence = opMatch[2] ? parseInt(opMatch[2], 10) : 1;
    animeName = normalized.replace(OP_PATTERNS, '');
  }

  // Clean up anime name: remove separators at edges, extra spaces
  animeName = animeName
    .replace(SEPARATORS, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!animeName) return null;

  return { raw: line, animeName, themeType, sequence };
}

/**
 * Parse a full text block (multi-line) into parsed entries.
 * Supports newlines, semicolons, and commas as separators.
 */
export function parseText(text: string): ParsedLine[] {
  // Split on newlines; also treat semicolons as line separators
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
  // Prefer highest resolution
  return [...entry.videos].sort((a, b) => (b.resolution || 0) - (a.resolution || 0))[0];
}

/**
 * Resolve a single parsed line against the AnimeThemes API.
 * Uses the same smart search as the rest of the app (abbreviations + Jikan fuzzy).
 */
export async function resolveLine(parsed: ParsedLine): Promise<ResolvedTheme> {
  try {
    const results = await searchAnime(parsed.animeName);

    if (!results.length) {
      return { parsed, status: 'not-found' };
    }

    // Check if the top result has the right theme
    const best = results[0];
    const theme = findTheme(best, parsed.themeType, parsed.sequence);

    if (!theme) {
      return { parsed, status: 'approx', anime: best, matchedName: best.name };
    }

    const video = getBestVideo(theme);
    const isExact =
      theme.type === parsed.themeType &&
      (theme.sequence || 1) === parsed.sequence;

    return {
      parsed,
      status: isExact ? 'found' : 'approx',
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
 * Resolve all parsed lines with concurrency control to avoid hammering APIs.
 * Processes 2 at a time with a small delay between batches.
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
    // Small delay between batches to be API-friendly
    if (i + BATCH_SIZE < lines.length) {
      await new Promise(r => setTimeout(r, 400));
    }
  }

  return results;
}
