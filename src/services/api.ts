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

const BASE_URL = 'https://api.animethemes.moe';
const THEMES_INCLUDE = 'animethemes.animethemeentries.videos,images';

/**
 * Common anime abbreviations → full titles
 * This handles cases where Jikan and AnimeThemes don't understand abbreviations
 */
const ABBREVIATIONS: Record<string, string> = {
  // Popular abbreviations
  'snk': 'Shingeki no Kyojin',
  'aot': 'Shingeki no Kyojin',
  'kny': 'Kimetsu no Yaiba',
  'ds': 'Kimetsu no Yaiba',
  'demon slayer': 'Kimetsu no Yaiba',
  'jjk': 'Jujutsu Kaisen',
  'mha': 'Boku no Hero Academia',
  'bnha': 'Boku no Hero Academia',
  'sao': 'Sword Art Online',
  'opm': 'One Punch Man',
  'fma': 'Fullmetal Alchemist',
  'fmab': 'Fullmetal Alchemist Brotherhood',
  'hxh': 'Hunter x Hunter',
  'dn': 'Death Note',
  'csm': 'Chainsaw Man',
  'op': 'One Piece',
  'rezero': 'Re:Zero kara Hajimeru Isekai Seikatsu',
  're zero': 'Re:Zero kara Hajimeru Isekai Seikatsu',
  're:zero': 'Re:Zero kara Hajimeru Isekai Seikatsu',
  'konosuba': 'Kono Subarashii Sekai ni Shukufuku wo',
  'aoe': 'Shingeki no Kyojin The Final Season',
  'bc': 'Black Clover',
  'mp100': 'Mob Psycho 100',
  'cg': 'Code Geass',
  'eva': 'Neon Genesis Evangelion',
  'nge': 'Neon Genesis Evangelion',
  'cb': 'Cowboy Bebop',
  'dbz': 'Dragon Ball Z',
  'dbs': 'Dragon Ball Super',
  'db': 'Dragon Ball',
  'fate': 'Fate/stay night',
  'fsn': 'Fate/stay night',
  'fz': 'Fate/Zero',
  'sxf': 'Spy x Family',
  'spy family': 'Spy x Family',
  'spy x family': 'Spy x Family',
  'frieren': 'Sousou no Frieren',
  'oshi no ko': 'Oshi no Ko',
  'onk': 'Oshi no Ko',
  'shield hero': 'Tate no Yuusha no Nariagari',
  'mushoku': 'Mushoku Tensei',
  'mt': 'Mushoku Tensei',
  'slime': 'Tensei Shitara Slime Datta Ken',
  'tensura': 'Tensei Shitara Slime Datta Ken',
  'dr stone': 'Dr. Stone',
  'drstone': 'Dr. Stone',
  'Tokyo ghoul': 'Tokyo Ghoul',
  'tg': 'Tokyo Ghoul',
  'ttgl': 'Tengen Toppa Gurren Lagann',
  'gurren lagann': 'Tengen Toppa Gurren Lagann',
  'klk': 'Kill la Kill',
  'sg': 'Steins;Gate',
  'steins gate': 'Steins;Gate',
  'steinsgate': 'Steins;Gate',
  'yba': 'Jojo no Kimyou na Bouken',
  'jojo': 'Jojo no Kimyou na Bouken',
  'jjba': 'Jojo no Kimyou na Bouken',
  'sbr': 'Jojo no Kimyou na Bouken Part 7 Steel Ball Run',
  'solo leveling': 'Ore dake Level Up na Ken',
  'bocchi': 'Bocchi the Rock',
  'dandadan': 'Dandadan',
  'blue lock': 'Blue Lock',
  'vinland': 'Vinland Saga',
  'berserk': 'Berserk',
  'bleach': 'Bleach',
  'naruto': 'Naruto',
  'inuyasha': 'InuYasha',
  'made in abyss': 'Made in Abyss',
  'mia': 'Made in Abyss',
  'overlord': 'Overlord',
  'kaguya': 'Kaguya-sama wa Kokurasetai',
  'love is war': 'Kaguya-sama wa Kokurasetai',
};

/**
 * Resolve an abbreviation to full title if known
 */
const resolveAbbreviation = (query: string): string | null => {
  const lower = query.toLowerCase().trim();
  return ABBREVIATIONS[lower] || null;
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
  
  // Step 2: Prepare all search promises in parallel
  const searchPromises: Promise<Anime[]>[] = [];

  // 2a. If we have an abbreviation match, search AnimeThemes with the full title
  if (abbreviationResolved) {
    searchPromises.push(
      fetch(`${BASE_URL}/anime?q=${encodeURIComponent(abbreviationResolved)}&include=${THEMES_INCLUDE}&page[size]=10`)
        .then(r => r.json())
        .then(d => d.anime || [])
        .catch(() => [])
    );
  }

  // 2b. Search AnimeThemes directly with original query
  searchPromises.push(
    fetch(`${BASE_URL}/anime?q=${encodeURIComponent(rawQuery)}&include=${THEMES_INCLUDE}&page[size]=10`)
      .then(r => r.json())
      .then(d => d.anime || [])
      .catch(() => [])
  );

  // 2c. Use Jikan to resolve typos/alternate names (get top 3 matches)
  searchPromises.push(
    (async () => {
      try {
        const jikanRes = await fetch(
          `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(rawQuery)}&limit=3`
        );
        if (!jikanRes.ok) return [];
        
        const jikanData = await jikanRes.json();
        if (!jikanData?.data?.length) return [];

        // For each Jikan result, search AnimeThemes with both title variants
        const jikanSearches = jikanData.data.flatMap((entry: { title?: string; title_english?: string }) => {
          const titles: string[] = [];
          if (entry.title) titles.push(entry.title);
          if (entry.title_english && entry.title_english !== entry.title) {
            titles.push(entry.title_english);
          }
          return titles;
        });

        // Search AnimeThemes for each Jikan-resolved title
        const uniqueTitles = [...new Set(jikanSearches)] as string[];
        const subPromises = uniqueTitles.slice(0, 4).map((title) =>
          fetch(`${BASE_URL}/anime?q=${encodeURIComponent(title)}&include=${THEMES_INCLUDE}&page[size]=3`)
            .then(r => r.json())
            .then(d => d.anime || [])
            .catch(() => [])
        );

        const subResults = await Promise.all(subPromises);
        return subResults.flat() as Anime[];
      } catch {
        return [];
      }
    })()
  );

  // Step 3: Wait for all results
  const allResults = await Promise.all(searchPromises);
  const merged = allResults.flat();

  // Step 4: Deduplicate by ID, keeping first occurrence (priority order: abbreviation > direct > jikan)
  const seen = new Set<number>();
  return merged.filter((a): a is Anime => {
    if (!a || !a.id || seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
};
