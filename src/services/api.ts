export interface Video {
  id: number;
  basename: string;
  link: string;
  resolution: number;
}

export interface AnimeThemeEntry {
  id: number;
  episodes: string;
  videos: Video[];
}

export interface AnimeTheme {
  id: number;
  slug: string;
  type: string;
  sequence: number;
  animethemeentries: AnimeThemeEntry[];
}

export interface Image {
  id: number;
  facet: string;
  link: string;
}

export interface Anime {
  id: number;
  name: string;
  slug: string;
  year: number;
  season: string;
  synopsis: string;
  animethemes: AnimeTheme[];
  images: Image[];
}

// ========== Jikan API types ==========

export interface JikanImage {
  image_url: string;
  small_image_url: string;
  large_image_url: string;
}

export interface JikanGenre {
  mal_id: number;
  name: string;
}

export interface JikanStudio {
  mal_id: number;
  name: string;
  url: string;
}

export interface JikanRelationEntry {
  mal_id: number;
  type: string;
  name: string;
  url: string;
}

export interface JikanRelation {
  relation: string;
  entry: JikanRelationEntry[];
}

export interface JikanRecommendationEntry {
  mal_id: number;
  url: string;
  images: { jpg: JikanImage; webp: JikanImage };
  title: string;
}

export interface JikanStreaming {
  name: string;
  url: string;
}

export interface JikanStaffPosition {
  type: string;
  name: string;
}

export interface JikanStaffPerson {
  mal_id: number;
  name: string;
  images: { jpg: { image_url: string } };
}

export interface JikanStaffEntry {
  person: JikanStaffPerson;
  positions: string[];
}

export interface JikanAnimeDetail {
  mal_id: number;
  title: string;
  title_english: string | null;
  title_japanese: string | null;
  synopsis: string | null;
  score: number;
  scored_by: number;
  rank: number;
  popularity: number;
  members: number;
  favorites: number;
  episodes: number | null;
  status: string;
  source: string;
  duration: string;
  rating: string;
  season: string | null;
  year: number | null;
  images: { jpg: JikanImage; webp: JikanImage };
  trailer: { youtube_id: string | null; url: string | null; embed_url: string | null };
  genres: JikanGenre[];
  themes: JikanGenre[];
  studios: JikanStudio[];
  relations: JikanRelation[];
  streaming: JikanStreaming[];
}

export interface JikanRecommendation {
  entry: JikanRecommendationEntry;
}

export interface JikanEpisode {
  mal_id: number;
  title: string;
  title_japanese: string | null;
  title_romanji: string | null;
  aired: string | null;
  filler: boolean;
  recap: boolean;
}

import { memoFetch } from './cache';

const JIKAN_BASE = 'https://api.jikan.moe/v4';

// Jikan rate limiter — serializes requests to respect the 3 req/s limit
let jikanNextSlot = 0;
const JIKAN_MIN_INTERVAL = 350;

const jikanFetch = async (url: string): Promise<Response> => {
  const now = Date.now();
  const wait = Math.max(0, jikanNextSlot - now);
  jikanNextSlot = Math.max(now, jikanNextSlot) + JIKAN_MIN_INTERVAL;
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  return fetch(url);
};

/**
 * Fetch full anime details from Jikan by MAL ID
 */
export const fetchJikanAnimeDetail = (malId: number): Promise<JikanAnimeDetail | null> =>
  memoFetch(`jikan:detail:${malId}`, async () => {
    try {
      const res = await jikanFetch(`${JIKAN_BASE}/anime/${malId}/full`);
      if (!res.ok) return null;
      const data = await res.json();
      return (data.data as JikanAnimeDetail) || null;
    } catch {
      return null;
    }
  });

/**
 * Fetch anime staff from Jikan (directors, composers, etc.)
 */
export const fetchJikanStaff = (malId: number): Promise<JikanStaffEntry[]> =>
  memoFetch(`jikan:staff:${malId}`, async () => {
    try {
      const res = await jikanFetch(`${JIKAN_BASE}/anime/${malId}/staff`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.data as JikanStaffEntry[]) || [];
    } catch {
      return [];
    }
  });

/**
 * Fetch anime recommendations from Jikan
 */
export const fetchJikanRecommendations = (malId: number): Promise<JikanRecommendation[]> =>
  memoFetch(`jikan:recs:${malId}`, async () => {
    try {
      const res = await jikanFetch(`${JIKAN_BASE}/anime/${malId}/recommendations`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.data as JikanRecommendation[]) || [];
    } catch {
      return [];
    }
  });

/**
 * Fetch anime episodes from Jikan
 */
export const fetchJikanEpisodes = (malId: number, page = 1): Promise<{ episodes: JikanEpisode[]; hasMore: boolean }> =>
  memoFetch(`jikan:episodes:${malId}:${page}`, async () => {
    try {
      const res = await jikanFetch(`${JIKAN_BASE}/anime/${malId}/episodes?page=${page}`);
      if (!res.ok) return { episodes: [], hasMore: false };
      const data = await res.json();
      return {
        episodes: (data.data as JikanEpisode[]) || [],
        hasMore: data.pagination?.has_next_page || false,
      };
    } catch {
      return { episodes: [] as JikanEpisode[], hasMore: false };
    }
  });

/**
 * Translate text to French using MyMemory API (free tier, ~500 chars/request).
 * Cached + chunks translated in parallel (previous impl was sequential).
 */
export const translateToFrench = (text: string): Promise<string> => {
  if (!text) return Promise.resolve('');
  // Cache key: short hash-ish of text to avoid unbounded keys.
  // We use the first 120 chars + length; good enough for idempotent inputs.
  const cacheKey = `mymemory:fr:${text.length}:${text.slice(0, 120)}`;
  return memoFetch(cacheKey, async () => {
    try {
      const MAX_CHUNK = 450;
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      const chunks: string[] = [];
      let current = '';
      for (const s of sentences) {
        if ((current + s).length > MAX_CHUNK && current) {
          chunks.push(current.trim());
          current = s;
        } else {
          current += s;
        }
      }
      if (current.trim()) chunks.push(current.trim());

      const translated = await Promise.all(
        chunks.map(async (chunk) => {
          try {
            const res = await fetch(
              `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=en|fr`
            );
            if (!res.ok) return chunk;
            const data = await res.json();
            return data.responseData?.translatedText || chunk;
          } catch {
            return chunk;
          }
        })
      );
      return translated.join(' ');
    } catch {
      return text;
    }
  }, 30 * 60 * 1000); // 30 minutes
};

/**
 * Search Jikan by anime name and return the best match's MAL ID
 */
export const findMalId = (animeName: string): Promise<number | null> =>
  memoFetch(`jikan:malid:${animeName.toLowerCase()}`, async () => {
    try {
      const res = await jikanFetch(`${JIKAN_BASE}/anime?q=${encodeURIComponent(animeName)}&limit=1`);
      if (!res.ok) return null;
      const data = await res.json();
      return (data.data?.[0]?.mal_id as number) || null;
    } catch {
      return null;
    }
  });

const BASE_URL = 'https://api.animethemes.moe';
const THEMES_INCLUDE = 'animethemes.animethemeentries.videos,images';

/**
 * Common anime abbreviations → full titles
 * This handles cases where Jikan and AnimeThemes don't understand abbreviations
 */
const ABBREVIATIONS: Record<string, string> = {
  // Attack on Titan / SNK
  'snk': 'Shingeki no Kyojin', 'aot': 'Shingeki no Kyojin',
  'attack on titan': 'Shingeki no Kyojin',
  'aoe': 'Shingeki no Kyojin The Final Season',
  // Demon Slayer / KNY
  'kny': 'Kimetsu no Yaiba', 'ds': 'Kimetsu no Yaiba',
  'demon slayer': 'Kimetsu no Yaiba',
  // JJK
  'jjk': 'Jujutsu Kaisen',
  // My Hero Academia
  'mha': 'Boku no Hero Academia', 'bnha': 'Boku no Hero Academia',
  'my hero': 'Boku no Hero Academia', 'my hero academia': 'Boku no Hero Academia',
  // SAO
  'sao': 'Sword Art Online',
  // One Punch Man
  'opm': 'One Punch Man',
  // Fullmetal Alchemist
  'fma': 'Fullmetal Alchemist', 'fmab': 'Fullmetal Alchemist Brotherhood',
  // Hunter x Hunter
  'hxh': 'Hunter x Hunter',
  // Death Note
  'dn': 'Death Note', 'death note': 'Death Note',
  // Chainsaw Man
  'csm': 'Chainsaw Man',
  // One Piece
  'op': 'One Piece',
  // Re:Zero
  'rezero': 'Re:Zero kara Hajimeru Isekai Seikatsu',
  're zero': 'Re:Zero kara Hajimeru Isekai Seikatsu',
  're:zero': 'Re:Zero kara Hajimeru Isekai Seikatsu',
  // KonoSuba
  'konosuba': 'Kono Subarashii Sekai ni Shukufuku wo',
  // Black Clover
  'bc': 'Black Clover',
  // Mob Psycho
  'mp100': 'Mob Psycho 100', 'mob psycho': 'Mob Psycho 100',
  // Code Geass
  'cg': 'Code Geass', 'code geass': 'Code Geass',
  // Evangelion
  'eva': 'Neon Genesis Evangelion', 'nge': 'Neon Genesis Evangelion',
  'evangelion': 'Neon Genesis Evangelion',
  // Cowboy Bebop
  'cb': 'Cowboy Bebop',
  // Dragon Ball
  'dbz': 'Dragon Ball Z', 'dbs': 'Dragon Ball Super', 'db': 'Dragon Ball',
  'dragon ball': 'Dragon Ball',
  // Fate
  'fate': 'Fate/stay night', 'fsn': 'Fate/stay night', 'fz': 'Fate/Zero',
  'fate zero': 'Fate/Zero', 'fate stay night': 'Fate/stay night',
  'ubw': 'Fate/stay night: Unlimited Blade Works',
  // Spy x Family
  'sxf': 'Spy x Family', 'spy family': 'Spy x Family', 'spy x family': 'Spy x Family',
  // Frieren
  'frieren': 'Sousou no Frieren',
  // Oshi no Ko
  'oshi no ko': 'Oshi no Ko', 'onk': 'Oshi no Ko',
  // Shield Hero
  'shield hero': 'Tate no Yuusha no Nariagari',
  // Mushoku Tensei
  'mushoku': 'Mushoku Tensei', 'mt': 'Mushoku Tensei',
  'mushoku tensei': 'Mushoku Tensei',
  // Slime
  'slime': 'Tensei Shitara Slime Datta Ken', 'tensura': 'Tensei Shitara Slime Datta Ken',
  // Dr. Stone
  'dr stone': 'Dr. Stone', 'drstone': 'Dr. Stone',
  // Tokyo Ghoul
  'tokyo ghoul': 'Tokyo Ghoul', 'tg': 'Tokyo Ghoul',
  // Gurren Lagann
  'ttgl': 'Tengen Toppa Gurren Lagann', 'gurren lagann': 'Tengen Toppa Gurren Lagann',
  // Kill la Kill
  'klk': 'Kill la Kill',
  // Steins;Gate
  'sg': 'Steins;Gate', 'steins gate': 'Steins;Gate', 'steinsgate': 'Steins;Gate',
  // JoJo
  'yba': 'Jojo no Kimyou na Bouken', 'jojo': 'Jojo no Kimyou na Bouken',
  'jjba': 'Jojo no Kimyou na Bouken',
  'sbr': 'Jojo no Kimyou na Bouken Part 7 Steel Ball Run',
  // Solo Leveling
  'solo leveling': 'Ore dake Level Up na Ken',
  // Bocchi
  'bocchi': 'Bocchi the Rock',
  // Dandadan
  'dandadan': 'Dandadan',
  // Blue Lock
  'blue lock': 'Blue Lock',
  // Vinland Saga
  'vinland': 'Vinland Saga',
  // Berserk
  'berserk': 'Berserk',
  // Bleach
  'bleach': 'Bleach', 'tybw': 'Bleach: Sennen Kessen-hen',
  // Naruto
  'naruto': 'Naruto', 'ns': 'Naruto Shippuuden', 'naruto shippuden': 'Naruto Shippuuden',
  // InuYasha
  'inuyasha': 'InuYasha',
  // Made in Abyss
  'made in abyss': 'Made in Abyss', 'mia': 'Made in Abyss',
  // Overlord
  'overlord': 'Overlord',
  // Kaguya
  'kaguya': 'Kaguya-sama wa Kokurasetai', 'love is war': 'Kaguya-sama wa Kokurasetai',
  // Toradora
  'toradora': 'Toradora!',
  // Your Name / Kimi no Na wa
  'your name': 'Kimi no Na wa.', 'kimi no na wa': 'Kimi no Na wa.',
  // Sword of the Stranger
  'classroom of the elite': 'Youkoso Jitsuryoku Shijou Shugi no Kyoushitsu e',
  'cote': 'Youkoso Jitsuryoku Shijou Shugi no Kyoushitsu e',
  // AOT variants
  'aot s2': 'Shingeki no Kyojin Season 2',
  'aot s3': 'Shingeki no Kyojin Season 3',
  'aot s4': 'Shingeki no Kyojin The Final Season',
  // Demon Slayer variants
  'kny s2': 'Kimetsu no Yaiba: Yuukaku-hen',
  'kny s3': 'Kimetsu no Yaiba: Katanakaji no Sato-hen',
  // Popular recent
  'nier': 'NieR:Automata Ver1.1a',
  'cyberpunk': 'Cyberpunk: Edgerunners',
  'edgerunners': 'Cyberpunk: Edgerunners',
  'ranking of kings': 'Ousama Ranking',
  'ousama ranking': 'Ousama Ranking',
  'odd taxi': 'Odd Taxi',
  'wonder egg': 'Wonder Egg Priority',
  'wonder egg priority': 'Wonder Egg Priority',
  'bunny girl': 'Seishun Buta Yarou wa Bunny Girl Senpai no Yume wo Minai',
  'bunny girl senpai': 'Seishun Buta Yarou wa Bunny Girl Senpai no Yume wo Minai',
  'tower of god': 'Kami no Tou',
  'tog': 'Kami no Tou',
  'rent a girlfriend': 'Kanojo, Okarishimasu',
  'kanokari': 'Kanojo, Okarishimasu',
  'quintessential quintuplets': 'Go-toubun no Hanayome',
  'gotoubun': 'Go-toubun no Hanayome',
  '5toubun': 'Go-toubun no Hanayome',
  'apothecary diaries': 'Kusuriya no Hitorigoto',
  'kusuriya': 'Kusuriya no Hitorigoto',
  'wind breaker': 'Wind Breaker',
  'kaiju no 8': 'Kaijuu 8-gou',
  'kaiju 8': 'Kaijuu 8-gou',
  'sakamoto days': 'Sakamoto Days',
  // Gintama
  'gintama': 'Gintama',
  // Haikyuu
  'haikyuu': 'Haikyuu!!', 'haikyu': 'Haikyuu!!',
  // Kuroko
  'knb': 'Kuroko no Basket', 'kuroko': 'Kuroko no Basket',
  // Assassination Classroom
  'assclass': 'Ansatsu Kyoushitsu', 'assassination classroom': 'Ansatsu Kyoushitsu',
  // Erased
  'erased': 'Boku dake ga Inai Machi',
  // Parasyte
  'parasyte': 'Kiseijuu: Sei no Kakuritsu',
  // Promised Neverland
  'tpn': 'Yakusoku no Neverland', 'promised neverland': 'Yakusoku no Neverland',
  // Tokyo Revengers
  'tokyo revengers': 'Tokyo Revengers', 'tr': 'Tokyo Revengers',
  // Demon Lord Retry / Eminence in Shadow
  'eminence in shadow': 'Kage no Jitsuryokusha ni Naritakute!',
  'shadow': 'Kage no Jitsuryokusha ni Naritakute!',
  // 86
  '86': '86: Eighty Six', 'eighty six': '86: Eighty Six',
  // Violet Evergarden
  'violet evergarden': 'Violet Evergarden', 've': 'Violet Evergarden',
  // Psycho-Pass
  'psycho pass': 'Psycho-Pass', 'psycho-pass': 'Psycho-Pass',
  // Mob Psycho
  'mob': 'Mob Psycho 100',
  // Angel Beats
  'angel beats': 'Angel Beats!',
  // Your Lie in April
  'your lie in april': 'Shigatsu wa Kimi no Uso', 'ylia': 'Shigatsu wa Kimi no Uso',
  // No Game No Life
  'ngnl': 'No Game No Life', 'no game no life': 'No Game No Life',
  // Noragami
  'noragami': 'Noragami',
  // Akame ga Kill
  'agk': 'Akame ga Kill!', 'akame ga kill': 'Akame ga Kill!',
  // Fairy Tail
  'ft': 'Fairy Tail', 'fairy tail': 'Fairy Tail',
  // Seven Deadly Sins
  'sds': 'Nanatsu no Taizai', 'seven deadly sins': 'Nanatsu no Taizai',
  // Dororo
  'dororo': 'Dororo',
  // Fire Force
  'fire force': 'Enen no Shouboutai',
  // Horimiya
  'horimiya': 'Horimiya',
  // Fruits Basket
  'fruits basket': 'Fruits Basket',
  // Grand Blue
  'grand blue': 'Grand Blue',
};

/**
 * Resolve abbreviation: exact match, then partial/fuzzy match
 */
const resolveAbbreviation = (query: string): string | null => {
  const lower = query.toLowerCase().trim();
  // Exact match
  if (ABBREVIATIONS[lower]) return ABBREVIATIONS[lower];
  // Partial match: check if query is a prefix of any key or key starts with query
  for (const [key, val] of Object.entries(ABBREVIATIONS)) {
    if (key.startsWith(lower) || lower.startsWith(key)) return val;
  }
  return null;
};

/**
 * Fetch a single theme by ID — includes video, song title, artists, anime images
 */
export interface ThemeDetail {
  id: number;
  type: string;
  sequence: number;
  slug: string;
  videoLink: string | null;
  songTitle: string | null;
  artistName: string | null;
  animeName: string | null;
  coverImage: string | null;
}

export const fetchThemeById = async (themeId: number | string): Promise<ThemeDetail | null> => {
  try {
    const res = await fetch(
      `${BASE_URL}/animetheme/${themeId}?include=animethemeentries.videos,song.artists,anime.images`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const t = data.animetheme;
    if (!t) return null;

    const entry = t.animethemeentries?.[0];
    const video = entry?.videos?.[0];
    const song = t.song;
    const artist = song?.artists?.[0];
    const anime = t.anime;
    const cover = anime?.images?.find((i: any) => i.facet === 'Large Cover')?.link
      || anime?.images?.find((i: any) => i.facet === 'Small Cover')?.link
      || null;

    return {
      id: t.id,
      type: t.type,
      sequence: t.sequence,
      slug: t.slug,
      videoLink: video?.link || null,
      songTitle: song?.title || null,
      artistName: artist?.name || null,
      animeName: anime?.name || null,
      coverImage: cover,
    };
  } catch {
    return null;
  }
};

/**
 * Fetch anime from this season (latest releases with themes)
 */
export const fetchThisSeason = async (): Promise<Anime[]> => {
  const response = await fetch(
    `${BASE_URL}/anime?sort=-year&include=${THEMES_INCLUDE}&page[size]=25`
  );
  const data = await response.json();
  const anime = (data.anime || []) as Anime[];
  return anime.filter(a => a.animethemes && a.animethemes.length > 0);
};

/**
 * Fetch all-time popular anime by searching individually
 */
export const fetchPopularAnime = async (): Promise<Anime[]> => {
  const popularTitles = [
    'Shingeki no Kyojin',
    'Naruto Shippuuden',
    'Death Note',
    'Fullmetal Alchemist Brotherhood',
    'Sword Art Online',
    'Cowboy Bebop',
    'Jujutsu Kaisen',
    'Kimetsu no Yaiba',
    'One Punch Man',
    'Chainsaw Man',
    'Spy x Family',
    'Mob Psycho 100',
    'Hunter x Hunter 2011',
    'Boku no Hero Academia',
    'Steins Gate',
  ];

  const promises = popularTitles.map(async (title) => {
    try {
      const res = await fetch(
        `${BASE_URL}/anime?q=${encodeURIComponent(title)}&include=${THEMES_INCLUDE}&page[size]=1`
      );
      const data = await res.json();
      const results = (data.anime || []) as Anime[];
      return results[0] || null;
    } catch {
      return null;
    }
  });

  const results = await Promise.all(promises);
  const seen = new Set<number>();
  return results.filter((a): a is Anime => {
    if (!a || !a.animethemes?.length || seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
};

/**
 * Smart search: resolves abbreviations, typos, and tries multiple strategies
 * 
 * Strategy:
 * 1. Check local abbreviation dictionary (instant, handles KNY, SNK, etc.)
 * 2. Search Jikan for up to 3 results (handles typos via MyAnimeList's fuzzy search)
 * 3. Search AnimeThemes directly with the original query (in parallel with Jikan)
 * 4. Merge and deduplicate all results
 */
export const searchAnime = async (query: string): Promise<Anime[]> => {
  if (!query.trim()) return [];

  // Limit query length to prevent abuse
  const rawQuery = query.trim().slice(0, 200);
  
  // Step 1: Check abbreviation dictionary
  const abbreviationResolved = resolveAbbreviation(rawQuery);
  
  // Step 2: Fast path — AnimeThemes direct searches (no rate limiting, parallel)
  const fastPromises: Promise<Anime[]>[] = [];

  if (abbreviationResolved) {
    fastPromises.push(
      fetch(`${BASE_URL}/anime?q=${encodeURIComponent(abbreviationResolved)}&include=${THEMES_INCLUDE}&page[size]=10`)
        .then(r => r.json())
        .then(d => d.anime || [])
        .catch(() => [])
    );
  }

  fastPromises.push(
    fetch(`${BASE_URL}/anime?q=${encodeURIComponent(rawQuery)}&include=${THEMES_INCLUDE}&page[size]=10`)
      .then(r => r.json())
      .then(d => d.anime || [])
      .catch(() => [])
  );

  // Step 3: Slow path — Jikan typo resolution (single request, top 3 only)
  const jikanPromise: Promise<Anime[]> = (async () => {
    try {
      const jikanRes = await jikanFetch(
        `${JIKAN_BASE}/anime?q=${encodeURIComponent(rawQuery)}&limit=3`
      );
      if (!jikanRes.ok) return [];
      
      const jikanData = await jikanRes.json();
      if (!jikanData?.data?.length) return [];

      // Collect unique titles from Jikan results
      const titles = new Set<string>();
      for (const entry of jikanData.data) {
        if (entry.title) titles.add(entry.title);
        if (entry.title_english && entry.title_english !== entry.title) {
          titles.add(entry.title_english);
        }
      }

      // Search AnimeThemes for up to 3 Jikan-resolved titles (parallel, fast)
      const subPromises = [...titles].slice(0, 3).map((title) =>
        fetch(`${BASE_URL}/anime?q=${encodeURIComponent(title)}&include=${THEMES_INCLUDE}&page[size]=5`)
          .then(r => r.json())
          .then(d => d.anime || [])
          .catch(() => [])
      );

      const subResults = await Promise.all(subPromises);
      return subResults.flat() as Anime[];
    } catch {
      return [];
    }
  })();

  // Step 4: Race — return fast results immediately if Jikan is slow
  const fastResults = (await Promise.all(fastPromises)).flat();
  
  // If AnimeThemes already found results, only give Jikan 1.5s to add more
  let jikanResults: Anime[] = [];
  if (fastResults.length > 0) {
    jikanResults = await Promise.race([
      jikanPromise,
      new Promise<Anime[]>(r => setTimeout(() => r([]), 1500)),
    ]);
  } else {
    // No fast results — wait for Jikan (it might resolve typos)
    jikanResults = await jikanPromise;
  }

  const merged = [...fastResults, ...jikanResults];

  // Step 5: Deduplicate by ID, keeping first occurrence (priority: abbreviation > direct > jikan)
  const seen = new Set<number>();
  return merged.filter((a): a is Anime => {
    if (!a || !a.id || seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
};
