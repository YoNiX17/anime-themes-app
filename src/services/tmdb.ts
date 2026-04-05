const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY as string;

function tmdbUrl(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set('api_key', TMDB_KEY);
  url.searchParams.set('language', 'fr-FR');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

export function tmdbImage(path: string | null, size = 'w500') {
  if (!path) return '';
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

// ========== Types ==========

export interface TMDBMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  runtime?: number;
  status?: string;
  tagline?: string;
  budget?: number;
  revenue?: number;
  production_companies?: { id: number; name: string; logo_path: string | null }[];
}

export interface TMDBTVShow {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  status?: string;
  tagline?: string;
  episode_run_time?: number[];
  networks?: { id: number; name: string; logo_path: string | null }[];
  seasons?: TMDBSeason[];
  created_by?: { id: number; name: string; profile_path: string | null }[];
}

export interface TMDBSeason {
  id: number;
  name: string;
  overview: string;
  season_number: number;
  episode_count: number;
  air_date: string | null;
  poster_path: string | null;
}

export interface TMDBCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface TMDBCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface TMDBVideo {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
}

export interface TMDBCredits {
  cast: TMDBCastMember[];
  crew: TMDBCrewMember[];
}

// ========== Fetch helpers ==========

async function tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const res = await fetch(tmdbUrl(path, params));
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

// ========== Movies ==========

export async function searchMovies(query: string): Promise<TMDBMovie[]> {
  const data = await tmdbFetch<{ results: TMDBMovie[] }>('/search/movie', { query });
  return data.results;
}

export async function fetchTrendingMovies(): Promise<TMDBMovie[]> {
  const data = await tmdbFetch<{ results: TMDBMovie[] }>('/trending/movie/week');
  return data.results.slice(0, 20);
}

export async function fetchPopularMovies(): Promise<TMDBMovie[]> {
  const data = await tmdbFetch<{ results: TMDBMovie[] }>('/movie/popular');
  return data.results.slice(0, 20);
}

export async function fetchMovieDetail(id: number): Promise<TMDBMovie> {
  return tmdbFetch<TMDBMovie>(`/movie/${id}`);
}

export async function fetchMovieCredits(id: number): Promise<TMDBCredits> {
  return tmdbFetch<TMDBCredits>(`/movie/${id}/credits`);
}

export async function fetchMovieVideos(id: number): Promise<TMDBVideo[]> {
  const data = await tmdbFetch<{ results: TMDBVideo[] }>(`/movie/${id}/videos`, { language: 'fr-FR' });
  let videos = data.results.filter(v => v.site === 'YouTube');
  if (videos.length === 0) {
    const en = await tmdbFetch<{ results: TMDBVideo[] }>(`/movie/${id}/videos`, { language: 'en-US' });
    videos = en.results.filter(v => v.site === 'YouTube');
  }
  return videos;
}

export async function fetchMovieRecommendations(id: number): Promise<TMDBMovie[]> {
  const data = await tmdbFetch<{ results: TMDBMovie[] }>(`/movie/${id}/recommendations`);
  return data.results.slice(0, 10);
}

// ========== TV Shows ==========

export async function searchTVShows(query: string): Promise<TMDBTVShow[]> {
  const data = await tmdbFetch<{ results: TMDBTVShow[] }>('/search/tv', { query });
  return data.results;
}

export async function fetchTrendingTVShows(): Promise<TMDBTVShow[]> {
  const data = await tmdbFetch<{ results: TMDBTVShow[] }>('/trending/tv/week');
  return data.results.slice(0, 20);
}

export async function fetchPopularTVShows(): Promise<TMDBTVShow[]> {
  const data = await tmdbFetch<{ results: TMDBTVShow[] }>('/tv/popular');
  return data.results.slice(0, 20);
}

export async function fetchTVDetail(id: number): Promise<TMDBTVShow> {
  return tmdbFetch<TMDBTVShow>(`/tv/${id}`);
}

export async function fetchTVCredits(id: number): Promise<TMDBCredits> {
  return tmdbFetch<TMDBCredits>(`/tv/${id}/credits`);
}

export async function fetchTVVideos(id: number): Promise<TMDBVideo[]> {
  const data = await tmdbFetch<{ results: TMDBVideo[] }>(`/tv/${id}/videos`, { language: 'fr-FR' });
  let videos = data.results.filter(v => v.site === 'YouTube');
  if (videos.length === 0) {
    const en = await tmdbFetch<{ results: TMDBVideo[] }>(`/tv/${id}/videos`, { language: 'en-US' });
    videos = en.results.filter(v => v.site === 'YouTube');
  }
  return videos;
}

export async function fetchTVRecommendations(id: number): Promise<TMDBTVShow[]> {
  const data = await tmdbFetch<{ results: TMDBTVShow[] }>(`/tv/${id}/recommendations`);
  return data.results.slice(0, 10);
}
