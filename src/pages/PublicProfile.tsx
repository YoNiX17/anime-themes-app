import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ref, get } from 'firebase/database';
import {
  User as UserIcon, BookOpen, Palette, Music, Timer,
  ArrowLeft, Loader2, Play, Film, Tv, BarChart3,
  Users as UsersIcon, TrendingUp
} from 'lucide-react';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { getAnimeName } from '../utils/animeGrouping';
import { tmdbImage } from '../services/tmdb';
import './PublicProfile.css';

/* ═══ Types ═══ */
interface AnimeRating {
  id: string;
  animeName: string;
  plot: number;
  characters: number;
  animation: number;
  ost: number;
  pacing: number;
  coverImage?: string;
  franchise?: string;
}

interface ThemeRating {
  id: string;
  animeName: string;
  themeType: string;
  themeSlug: string;
  music: number;
  animation: number;
}

interface MediaRating {
  id: string;
  title: string;
  posterPath?: string;
  scores: Record<string, number>;
}

interface AnimeGroup {
  anime: string;
  entries: AnimeRating[];
  avgOverall: number;
  latestCover?: string;
}

type Tab = 'anime' | 'themes' | 'films' | 'series' | 'stats';

/* ═══ Stats helpers ═══ */
function computeStats(
  animeRatings: AnimeRating[],
  themeRatings: ThemeRating[],
  movieRatings: MediaRating[],
  seriesRatings: MediaRating[],
) {
  const total = animeRatings.length + themeRatings.length + movieRatings.length + seriesRatings.length;

  const animeCatAvg = (key: keyof AnimeRating) => {
    if (animeRatings.length === 0) return 0;
    return Math.round(animeRatings.reduce((s, r) => s + (r[key] as number || 0), 0) / animeRatings.length);
  };

  const animeAvg = animeRatings.length > 0
    ? Math.round(animeRatings.reduce((s, r) => s + (r.plot + r.characters + r.animation + r.ost + r.pacing) / 5, 0) / animeRatings.length)
    : 0;

  const themeAvg = themeRatings.length > 0
    ? Math.round(themeRatings.reduce((s, r) => s + (r.music + r.animation) / 2, 0) / themeRatings.length)
    : 0;

  const movieAvg = movieRatings.length > 0
    ? Math.round(movieRatings.reduce((s, r) => {
        const keys = Object.values(r.scores);
        return s + keys.reduce((a, b) => a + b, 0) / keys.length;
      }, 0) / movieRatings.length)
    : 0;

  const seriesAvg = seriesRatings.length > 0
    ? Math.round(seriesRatings.reduce((s, r) => {
        const keys = Object.values(r.scores);
        return s + keys.reduce((a, b) => a + b, 0) / keys.length;
      }, 0) / seriesRatings.length)
    : 0;

  // Distribution histogram (all anime scores)
  const distribution = [0, 0, 0, 0, 0]; // 0-20, 20-40, 40-60, 60-80, 80-100
  animeRatings.forEach(r => {
    const avg = (r.plot + r.characters + r.animation + r.ost + r.pacing) / 5;
    const idx = Math.min(Math.floor(avg / 20), 4);
    distribution[idx]++;
  });

  // Best & worst rated anime
  const sortedAnime = [...animeRatings].sort((a, b) => {
    const avgA = (a.plot + a.characters + a.animation + a.ost + a.pacing) / 5;
    const avgB = (b.plot + b.characters + b.animation + b.ost + b.pacing) / 5;
    return avgB - avgA;
  });

  return {
    total,
    animeCount: animeRatings.length,
    themeCount: themeRatings.length,
    movieCount: movieRatings.length,
    seriesCount: seriesRatings.length,
    animeAvg,
    themeAvg,
    movieAvg,
    seriesAvg,
    animeCats: {
      plot: animeCatAvg('plot'),
      characters: animeCatAvg('characters'),
      animation: animeCatAvg('animation'),
      ost: animeCatAvg('ost'),
      pacing: animeCatAvg('pacing'),
    },
    distribution,
    best: sortedAnime[0] || null,
    worst: sortedAnime.length > 1 ? sortedAnime[sortedAnime.length - 1] : null,
  };
}

/* ═══ Component ═══ */
export const PublicProfile: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [animeRatings, setAnimeRatings] = useState<AnimeRating[]>([]);
  const [themeRatings, setThemeRatings] = useState<ThemeRating[]>([]);
  const [movieRatings, setMovieRatings] = useState<MediaRating[]>([]);
  const [seriesRatings, setSeriesRatings] = useState<MediaRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<Tab>('anime');

  // Redirect to own profile if viewing self
  const isOwnProfile = user?.uid === userId;

  useEffect(() => {
    if (!userId) return;
    loadProfile(userId);
  }, [userId]);

  const loadProfile = async (uid: string) => {
    setLoading(true);
    try {
      const [profileSnap, ratingsSnap, themesSnap, moviesSnap, seriesSnap] = await Promise.all([
        get(ref(db, `users/${uid}/profile`)),
        get(ref(db, `users/${uid}/ratings`)),
        get(ref(db, `users/${uid}/themeRatings`)),
        get(ref(db, `users/${uid}/movieRatings`)),
        get(ref(db, `users/${uid}/seriesRatings`)),
      ]);

      if (!profileSnap.exists() && !ratingsSnap.exists()) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Profile
      const profile = profileSnap.val() || {};
      setDisplayName(profile.displayName || 'Utilisateur');
      setAvatarUrl(profile.avatarUrl || null);

      // Anime ratings
      if (ratingsSnap.exists()) {
        const data = ratingsSnap.val();
        setAnimeRatings(Object.entries(data).map(([id, d]: [string, any]) => ({
          id,
          animeName: d.animeName || `Anime #${id}`,
          plot: d.plot || 0,
          characters: d.characters || 0,
          animation: d.animation || 0,
          ost: d.ost || 0,
          pacing: d.pacing || 0,
          coverImage: d.coverImage,
          franchise: d.franchise,
        })));
      }

      // Theme ratings
      if (themesSnap.exists()) {
        const data = themesSnap.val();
        setThemeRatings(Object.entries(data).map(([id, d]: [string, any]) => ({
          id,
          animeName: d.animeName || 'Inconnu',
          themeType: d.themeType || 'OP',
          themeSlug: d.themeSlug || '',
          music: d.music || 0,
          animation: d.animation || 0,
        })));
      }

      // Movie ratings
      if (moviesSnap.exists()) {
        const data = moviesSnap.val();
        setMovieRatings(Object.entries(data).map(([id, d]: [string, any]) => ({
          id,
          title: d.mediaTitle || `Film #${id}`,
          posterPath: d.posterPath,
          scores: {
            scenario: d.scenario || 0,
            acting: d.acting || 0,
            directing: d.directing || 0,
            music: d.music || 0,
          },
        })));
      }

      // Series ratings
      if (seriesSnap.exists()) {
        const data = seriesSnap.val();
        setSeriesRatings(Object.entries(data).map(([id, d]: [string, any]) => ({
          id,
          title: d.mediaTitle || `Série #${id}`,
          posterPath: d.posterPath,
          scores: {
            scenario: d.scenario || 0,
            acting: d.acting || 0,
            directing: d.directing || 0,
            music: d.music || 0,
            pacing: d.pacing || 0,
          },
        })));
      }
    } catch {
      setNotFound(true);
    }
    setLoading(false);
  };

  const animeGroups = useMemo((): AnimeGroup[] => {
    const map = new Map<string, AnimeRating[]>();
    animeRatings.forEach(r => {
      const anime = getAnimeName(r.animeName, r.franchise);
      const existing = map.get(anime) || [];
      existing.push(r);
      map.set(anime, existing);
    });
    return Array.from(map.entries()).map(([anime, entries]) => {
      const n = entries.length;
      const avgOverall = entries.reduce((s, e) =>
        s + (e.plot + e.characters + e.animation + e.ost + e.pacing) / 5, 0) / n;
      return {
        anime,
        entries,
        avgOverall,
        latestCover: entries.find(e => e.coverImage)?.coverImage,
      };
    }).sort((a, b) => b.avgOverall - a.avgOverall);
  }, [animeRatings]);

  const stats = useMemo(() =>
    computeStats(animeRatings, themeRatings, movieRatings, seriesRatings),
    [animeRatings, themeRatings, movieRatings, seriesRatings]
  );

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'pp-score-legendary';
    if (score >= 75) return 'pp-score-excellent';
    if (score >= 50) return 'pp-score-good';
    if (score >= 30) return 'pp-score-average';
    return 'pp-score-low';
  };

  const getMediaOverall = (r: MediaRating) => {
    const vals = Object.values(r.scores);
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  };

  if (loading) {
    return (
      <div className="pp-container">
        <div className="pp-main">
          <div className="pp-loading"><Loader2 size={32} className="pp-spin" /></div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="pp-container">
        <div className="pp-main">
          <div className="pp-not-found glass-panel">
            <UserIcon size={48} />
            <h2>Profil introuvable</h2>
            <p>Cet utilisateur n'existe pas ou n'a pas encore de données.</p>
            <button className="pp-back-btn" onClick={() => navigate('/')}>
              <ArrowLeft size={16} /> Retour
            </button>
          </div>
        </div>
      </div>
    );
  }

  const TABS: { key: Tab; label: string; icon: React.ElementType; count: number }[] = [
    { key: 'anime', label: 'Anime', icon: Play, count: animeRatings.length },
    { key: 'themes', label: 'OP/ED', icon: Music, count: themeRatings.length },
    { key: 'films', label: 'Films', icon: Film, count: movieRatings.length },
    { key: 'series', label: 'Séries', icon: Tv, count: seriesRatings.length },
    { key: 'stats', label: 'Stats', icon: BarChart3, count: 0 },
  ];

  const sortedThemes = [...themeRatings].sort((a, b) => (b.music + b.animation) / 2 - (a.music + a.animation) / 2);
  const sortedMovies = [...movieRatings].sort((a, b) => getMediaOverall(b) - getMediaOverall(a));
  const sortedSeries = [...seriesRatings].sort((a, b) => getMediaOverall(b) - getMediaOverall(a));

  const maxDist = Math.max(...stats.distribution, 1);

  const ANIME_CAT_META = [
    { key: 'plot', label: 'Scénario', color: '#8b5cf6', icon: BookOpen },
    { key: 'characters', label: 'Personnages', color: '#06d6a0', icon: UsersIcon },
    { key: 'animation', label: 'Animation', color: '#f72585', icon: Palette },
    { key: 'ost', label: 'OST', color: '#fbbf24', icon: Music },
    { key: 'pacing', label: 'Rythme', color: '#06b6d4', icon: Timer },
  ];

  return (
    <div className="pp-container">
      <div className="pp-main">
        <button className="pp-back-btn" onClick={() => navigate(-1 as any)}>
          <ArrowLeft size={16} /> Retour
        </button>

        {/* Hero */}
        <div className="pp-hero glass-panel">
          <div className="pp-avatar">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="pp-avatar-img" />
            ) : (
              <UserIcon size={40} />
            )}
          </div>
          <h2 className="pp-name">{displayName}</h2>
          {isOwnProfile && <p className="pp-own-badge">C'est toi !</p>}
          <div className="pp-hero-stats">
            <div className="pp-stat"><span className="pp-stat-val">{stats.animeCount}</span><span className="pp-stat-lbl">Anime</span></div>
            <div className="pp-stat"><span className="pp-stat-val">{stats.themeCount}</span><span className="pp-stat-lbl">OP/ED</span></div>
            <div className="pp-stat"><span className="pp-stat-val">{stats.movieCount}</span><span className="pp-stat-lbl">Films</span></div>
            <div className="pp-stat"><span className="pp-stat-val">{stats.seriesCount}</span><span className="pp-stat-lbl">Séries</span></div>
          </div>
        </div>

        {/* Tabs */}
        <div className="pp-tabs">
          {TABS.map(t => (
            <button
              key={t.key}
              className={`pp-tab ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              <t.icon size={14} />
              {t.label}
              {t.count > 0 && <span className="pp-tab-count">{t.count}</span>}
            </button>
          ))}
        </div>

        {/* ANIME TAB */}
        {tab === 'anime' && (
          <div className="pp-section">
            {animeGroups.length === 0 ? (
              <div className="pp-empty glass-panel"><p>Aucun anime noté.</p></div>
            ) : (
              <div className="pp-anime-list">
                {animeGroups.map((g, i) => {
                  const score = Math.round(g.avgOverall);
                  return (
                    <div key={g.anime} className="pp-anime-row glass-panel">
                      <span className="pp-rank">#{i + 1}</span>
                      {g.latestCover && <img src={g.latestCover} alt="" className="pp-anime-cover" />}
                      <div className="pp-anime-info">
                        <span className="pp-anime-name">{g.anime}</span>
                        <span className="pp-anime-sub">{g.entries.length} saison{g.entries.length > 1 ? 's' : ''}</span>
                      </div>
                      <span className={`pp-score ${getScoreColor(score)}`}>{score}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* THEMES TAB */}
        {tab === 'themes' && (
          <div className="pp-section">
            {sortedThemes.length === 0 ? (
              <div className="pp-empty glass-panel"><p>Aucun OP/ED noté.</p></div>
            ) : (
              <div className="pp-theme-list">
                {sortedThemes.map((r, i) => {
                  const avg = Math.round((r.music + r.animation) / 2);
                  return (
                    <div key={r.id} className="pp-theme-row glass-panel">
                      <span className="pp-rank">#{i + 1}</span>
                      <span className="pp-theme-badge">{r.themeType}</span>
                      <div className="pp-theme-info">
                        <span className="pp-theme-name">{r.animeName}</span>
                        <div className="pp-theme-cats">
                          <span style={{ color: '#f72585' }}><Music size={11} /> {r.music}</span>
                          <span style={{ color: '#06b6d4' }}><Palette size={11} /> {r.animation}</span>
                        </div>
                      </div>
                      <span className={`pp-score ${getScoreColor(avg)}`}>{avg}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* FILMS TAB */}
        {tab === 'films' && (
          <div className="pp-section">
            {sortedMovies.length === 0 ? (
              <div className="pp-empty glass-panel"><p>Aucun film noté.</p></div>
            ) : (
              <div className="pp-media-list">
                {sortedMovies.map((r, i) => {
                  const ov = getMediaOverall(r);
                  return (
                    <div key={r.id} className="pp-media-row glass-panel">
                      <span className="pp-rank">#{i + 1}</span>
                      {r.posterPath ? (
                        <img src={tmdbImage(r.posterPath, 'w92')} alt="" className="pp-media-poster" />
                      ) : (
                        <div className="pp-media-placeholder" />
                      )}
                      <div className="pp-media-info">
                        <span className="pp-media-title">{r.title}</span>
                      </div>
                      <span className={`pp-score ${getScoreColor(ov)}`}>{ov}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SERIES TAB */}
        {tab === 'series' && (
          <div className="pp-section">
            {sortedSeries.length === 0 ? (
              <div className="pp-empty glass-panel"><p>Aucune série notée.</p></div>
            ) : (
              <div className="pp-media-list">
                {sortedSeries.map((r, i) => {
                  const ov = getMediaOverall(r);
                  return (
                    <div key={r.id} className="pp-media-row glass-panel">
                      <span className="pp-rank">#{i + 1}</span>
                      {r.posterPath ? (
                        <img src={tmdbImage(r.posterPath, 'w92')} alt="" className="pp-media-poster" />
                      ) : (
                        <div className="pp-media-placeholder" />
                      )}
                      <div className="pp-media-info">
                        <span className="pp-media-title">{r.title}</span>
                      </div>
                      <span className={`pp-score ${getScoreColor(ov)}`}>{ov}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* STATS TAB */}
        {tab === 'stats' && (
          <div className="pp-section pp-stats-section">
            {/* Global averages */}
            <div className="pp-stats-grid">
              {stats.animeCount > 0 && (
                <div className="pp-stats-card glass-panel">
                  <Play size={18} className="pp-stats-icon" style={{ color: '#8b5cf6' }} />
                  <span className="pp-stats-card-val">{stats.animeAvg}</span>
                  <span className="pp-stats-card-lbl">Moy. anime</span>
                </div>
              )}
              {stats.themeCount > 0 && (
                <div className="pp-stats-card glass-panel">
                  <Music size={18} className="pp-stats-icon" style={{ color: '#f72585' }} />
                  <span className="pp-stats-card-val">{stats.themeAvg}</span>
                  <span className="pp-stats-card-lbl">Moy. OP/ED</span>
                </div>
              )}
              {stats.movieCount > 0 && (
                <div className="pp-stats-card glass-panel">
                  <Film size={18} className="pp-stats-icon" style={{ color: '#e63946' }} />
                  <span className="pp-stats-card-val">{stats.movieAvg}</span>
                  <span className="pp-stats-card-lbl">Moy. films</span>
                </div>
              )}
              {stats.seriesCount > 0 && (
                <div className="pp-stats-card glass-panel">
                  <Tv size={18} className="pp-stats-icon" style={{ color: '#3a86ff' }} />
                  <span className="pp-stats-card-val">{stats.seriesAvg}</span>
                  <span className="pp-stats-card-lbl">Moy. séries</span>
                </div>
              )}
            </div>

            {/* Anime category breakdown */}
            {stats.animeCount > 0 && (
              <div className="pp-stats-breakdown glass-panel">
                <h3><TrendingUp size={16} /> Moyennes par catégorie (anime)</h3>
                <div className="pp-stats-bars">
                  {ANIME_CAT_META.map(c => {
                    const val = stats.animeCats[c.key as keyof typeof stats.animeCats];
                    return (
                      <div key={c.key} className="pp-stats-bar-row">
                        <div className="pp-stats-bar-label" style={{ color: c.color }}>
                          <c.icon size={13} /> {c.label}
                        </div>
                        <div className="pp-stats-bar-track">
                          <div
                            className="pp-stats-bar-fill"
                            style={{ width: `${val}%`, background: c.color }}
                          />
                        </div>
                        <span className="pp-stats-bar-val" style={{ color: c.color }}>{val}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Distribution */}
            {stats.animeCount > 2 && (
              <div className="pp-stats-dist glass-panel">
                <h3><BarChart3 size={16} /> Distribution des notes anime</h3>
                <div className="pp-dist-chart">
                  {['0-20', '20-40', '40-60', '60-80', '80-100'].map((label, i) => (
                    <div key={label} className="pp-dist-col">
                      <div className="pp-dist-bar-wrapper">
                        <div
                          className="pp-dist-bar"
                          style={{ height: `${(stats.distribution[i] / maxDist) * 100}%` }}
                        />
                      </div>
                      <span className="pp-dist-count">{stats.distribution[i]}</span>
                      <span className="pp-dist-label">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Best & worst */}
            {stats.best && (
              <div className="pp-stats-extremes glass-panel">
                <div className="pp-extreme">
                  <span className="pp-extreme-label">Meilleure note</span>
                  <span className="pp-extreme-name">{stats.best.animeName}</span>
                  <span className={`pp-extreme-score ${getScoreColor(Math.round((stats.best.plot + stats.best.characters + stats.best.animation + stats.best.ost + stats.best.pacing) / 5))}`}>
                    {Math.round((stats.best.plot + stats.best.characters + stats.best.animation + stats.best.ost + stats.best.pacing) / 5)}/100
                  </span>
                </div>
                {stats.worst && stats.worst.id !== stats.best.id && (
                  <div className="pp-extreme">
                    <span className="pp-extreme-label">Plus basse note</span>
                    <span className="pp-extreme-name">{stats.worst.animeName}</span>
                    <span className={`pp-extreme-score ${getScoreColor(Math.round((stats.worst.plot + stats.worst.characters + stats.worst.animation + stats.worst.ost + stats.worst.pacing) / 5))}`}>
                      {Math.round((stats.worst.plot + stats.worst.characters + stats.worst.animation + stats.worst.ost + stats.worst.pacing) / 5)}/100
                    </span>
                  </div>
                )}
              </div>
            )}

            {stats.total === 0 && (
              <div className="pp-empty glass-panel"><p>Pas encore de statistiques.</p></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
