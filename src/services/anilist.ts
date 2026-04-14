const ANILIST_URL = 'https://graphql.anilist.co';

// ── Types ──

export interface AniListCharacterName {
  full: string;
  native: string | null;
  alternative: string[];
}

export interface AniListCharacterImage {
  large: string;
  medium: string;
}

export interface AniListDateOfBirth {
  year: number | null;
  month: number | null;
  day: number | null;
}

export interface AniListMediaNode {
  id: number;
  title: { romaji: string; english: string | null };
  coverImage: { large: string } | null;
  type: 'ANIME' | 'MANGA';
  format: string | null;
}

export interface AniListCharacter {
  id: number;
  name: AniListCharacterName;
  image: AniListCharacterImage;
  description: string | null;
  age: string | null;
  gender: string | null;
  dateOfBirth: AniListDateOfBirth | null;
  favourites: number;
  role: 'MAIN' | 'SUPPORTING' | 'BACKGROUND';
  media?: { nodes: AniListMediaNode[] };
}

export interface AniListCharacterDetail {
  id: number;
  name: AniListCharacterName;
  image: AniListCharacterImage;
  description: string | null;
  age: string | null;
  gender: string | null;
  dateOfBirth: AniListDateOfBirth | null;
  favourites: number;
  media: { nodes: AniListMediaNode[] };
}

// ── GraphQL queries ──

const CHARACTERS_QUERY = `
query ($search: String) {
  Media(search: $search, type: ANIME) {
    characters(sort: [ROLE, FAVOURITES_DESC], perPage: 16) {
      edges {
        role
        node {
          id
          name { full native alternative }
          image { large medium }
          age
          gender
          favourites
        }
      }
    }
  }
}`;

const CHARACTER_DETAIL_QUERY = `
query ($id: Int) {
  Character(id: $id) {
    id
    name { full native alternative }
    image { large medium }
    description(asHtml: false)
    age
    gender
    dateOfBirth { year month day }
    favourites
    media(sort: POPULARITY_DESC, perPage: 12) {
      nodes {
        id
        title { romaji english }
        coverImage { large }
        type
        format
      }
    }
  }
}`;

// ── Fetch helpers ──

async function anilistFetch<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(ANILIST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch characters for an anime by name.
 * Returns up to 16 characters sorted by role then popularity.
 */
export async function fetchAniListCharacters(animeName: string): Promise<AniListCharacter[]> {
  const data = await anilistFetch<{
    Media: {
      characters: {
        edges: Array<{ role: string; node: Omit<AniListCharacter, 'role'> }>;
      };
    };
  }>(CHARACTERS_QUERY, { search: animeName });

  if (!data?.Media?.characters?.edges) return [];

  return data.Media.characters.edges.map(edge => ({
    ...edge.node,
    role: edge.role as AniListCharacter['role'],
  }));
}

/**
 * Fetch full character detail by AniList character ID.
 * Used for the character modal (lazy-loaded on click).
 */
export async function fetchAniListCharacterDetail(characterId: number): Promise<AniListCharacterDetail | null> {
  const data = await anilistFetch<{ Character: AniListCharacterDetail }>(
    CHARACTER_DETAIL_QUERY,
    { id: characterId },
  );
  return data?.Character ?? null;
}
