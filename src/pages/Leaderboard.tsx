import { useEffect, useState, useMemo, useCallback } from 'react';
import { ref, onValue } from 'firebase/database';
import { Trophy, BookOpen, Palette, Music, Timer, BarChart3, Loader2, ArrowLeft, Users as UsersIcon, Play, Layers, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebase';
import { getAnimeName } from '../utils/animeGrouping';
import { fetchThemeById, type ThemeDetail } from '../services/api';
import './Leaderboard.css';

type ViewMode = 'anime' | 'themes';
type AnimeViewMode = 'anime' | 'season';
type AnimeTab = 'overall' | 'plot' | 'characters' | 'animation' | 'ost' | 'pacing';
type ThemeTab = 'overall' | 'music' | 'animation';

const ANIME_TABS: { key: AnimeTab; label: string; icon: React.ElementType }[] = [
  { key: 'overall', label: 'Général', icon: BarChart3 },
  { key: 'plot', label: 'Scénario', icon: BookOpen },
  { key: 'characters', label: 'Persos', icon: UsersIcon },
  { key: 'animation', label: 'Animation', icon: Palette },
  { key: 'ost', label: 'OST', icon: Music },
  { key: 'pacing', label: 'Rythme', icon: Timer },
];

const THEME_TABS: { key: ThemeTab; label: string; icon: React.ElementType }[] = [
  { key: 'overall', label: 'Général', icon: BarChart3 },
  { key: 'music', label: 'Musique', icon: Music },
  { key: 'animation', label: 'Animation', icon: Palette },
];

interface AnimeRating {
  animeId: string;
  animeName: string;
  coverImage?: string;
  franchise?: string;
  avgPlot: number;
  avgCharacters: number;
  avgAnimation: number;
  avgOst: number;
  avgPacing: number;
  avgOverall: number;
  count: number;
}

interface ThemeRating {
  themeId: string;
  animeId?: string;
  animeName: string;
  themeType: string;
  themeSlug: string;
  coverImage?: string;
  avgMusic: number;
  avgAnimation: number;
  avgOverall: number;
  count: number;
}

interface AnimeGroupRating {
  anime: string;
  coverImage?: string;
  avgPlot: number;
  avgCharacters: number;
  avgAnimation: number;
  avgOst: number;
  avgPacing: number;
  avgOverall: number;
  totalCount: number;
  seasonCount: number;
}

export const Leaderboard: React.FC = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('anime');
  const [animeRatings, setAnimeRatings] = useState<AnimeRating[]>([]);
  const [themeRatings, setThemeRatings] = useState<ThemeRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [animeTab, setAnimeTab] = useState<AnimeTab>('overall');
  const [themeTab, setThemeTab] = useState<ThemeTab>('overall');
  const [animeViewMode, setAnimeViewMode] = useState<AnimeViewMode>('anime');
  const [playingTheme, setPlayingTheme] = useState<ThemeDetail | null>(null);
  const [loadingThemeId, setLoadingThemeId] = useState<string | null>(null);

  const handleThemeClick = useCallback(async (themeId: string) => {
    setLoadingThemeId(themeId);
    const detail = await fetchThemeById(themeId);
    setLoadingThemeId(null);
    if (detail?.videoLink) {
      setPlayingTheme(detail);
      document.body.style.overflow = 'hidden';
    }
  }, []);

  const handleClosePlayer = useCallback(() => {
    setPlayingTheme(null);
    document.body.style.overflow = '';
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!playingTheme) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClosePlayer(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [playingTheme, handleClosePlayer]);

  // Fetch anime ratings
  useEffect(() => {
    const ratingsRef = ref(db, 'ratings');
    const unsub = onValue(ratingsRef, (snapshot) => {
      if (!snapshot.exists()) { setAnimeRatings([]); setLoading(false); return; }
      const data = snapshot.val();
      const results: AnimeRating[] = [];

      Object.entries(data).forEach(([animeId, animeData]: [string, any]) => {
        const meta = animeData?.meta;
        const users = animeData?.users;
        if (!users) return;
        const entries = Object.values(users) as Record<string, number>[];
        if (entries.length === 0) return;

        let totals = { plot: 0, characters: 0, animation: 0, ost: 0, pacing: 0 };
        let count = 0;
        entries.forEach((e) => {
          const hasAny = (e.plot || 0) + (e.characters || 0) + (e.animation || 0) + (e.ost || 0) + (e.pacing || 0);
          if (hasAny > 0) {
            totals.plot += e.plot || 0;
            totals.characters += e.characters || 0;
            totals.animation += e.animation || 0;
            totals.ost += e.ost || 0;
            totals.pacing += e.pacing || 0;
            count++;
          }
        });
        if (count === 0) return;

        results.push({
          animeId,
          animeName: meta?.animeName || `Anime #${animeId}`,
          coverImage: meta?.coverImage || undefined,
          franchise: meta?.franchise || undefined,
          avgPlot: totals.plot / count,
          avgCharacters: totals.characters / count,
          avgAnimation: totals.animation / count,
          avgOst: totals.ost / count,
          avgPacing: totals.pacing / count,
          avgOverall: (totals.plot + totals.characters + totals.animation + totals.ost + totals.pacing) / (5 * count),
          count,
        });
      });

      setAnimeRatings(results);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Fetch theme ratings
  useEffect(() => {
    const ratingsRef = ref(db, 'themeRatings');
    const unsub = onValue(ratingsRef, (snapshot) => {
      if (!snapshot.exists()) { setThemeRatings([]); return; }
      const data = snapshot.val();
      const results: ThemeRating[] = [];

      Object.entries(data).forEach(([themeId, themeData]: [string, any]) => {
        const meta = themeData?.meta;
        const users = themeData?.users;
        if (!users) return;
        const entries = Object.values(users) as Record<string, number>[];
        if (entries.length === 0) return;

        let totalMusic = 0, totalAnimation = 0, count = 0;
        entries.forEach((e) => {
          const hasAny = (e.music || 0) + (e.animation || 0);
          if (hasAny > 0) {
            totalMusic += e.music || 0;
            totalAnimation += e.animation || 0;
            count++;
          }
        });
        if (count === 0) return;

        results.push({
          themeId,
          animeId: meta?.animeId ? String(meta.animeId) : undefined,
          animeName: meta?.animeName || `Theme #${themeId}`,
          themeType: meta?.themeType || 'OP',
          themeSlug: meta?.themeSlug || '',
          coverImage: meta?.coverImage || undefined,
          avgMusic: totalMusic / count,
          avgAnimation: totalAnimation / count,
          avgOverall: (totalMusic + totalAnimation) / (2 * count),
          count,
        });
      });

      setThemeRatings(results);
    });
    return () => unsub();
  }, []);

  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'score-legendary';
    if (score >= 75) return 'score-excellent';
    if (score >= 50) return 'score-good';
    if (score >= 30) return 'score-average';
    return 'score-low';
  };

  const getMedalEmoji = (rank: number): string | null => {
    if (rank === 0) return '🥇';
    if (rank === 1) return '🥈';
    if (rank === 2) return '🥉';
    return null;
  };

  // Sort anime ratings
  const getSortedAnime = (): AnimeRating[] => {
    const sorted = [...animeRatings];
    switch (animeTab) {
      case 'plot': return sorted.sort((a, b) => b.avgPlot - a.avgPlot);
      case 'characters': return sorted.sort((a, b) => b.avgCharacters - a.avgCharacters);
      case 'animation': return sorted.sort((a, b) => b.avgAnimation - a.avgAnimation);
      case 'ost': return sorted.sort((a, b) => b.avgOst - a.avgOst);
      case 'pacing': return sorted.sort((a, b) => b.avgPacing - a.avgPacing);
      default: return sorted.sort((a, b) => b.avgOverall - a.avgOverall);
    }
  };

  const getAnimeScore = (r: AnimeRating): number => {
    switch (animeTab) {
      case 'plot': return r.avgPlot;
      case 'characters': return r.avgCharacters;
      case 'animation': return r.avgAnimation;
      case 'ost': return r.avgOst;
      case 'pacing': return r.avgPacing;
      default: return r.avgOverall;
    }
  };

  // Enrich theme ratings with cover images from anime ratings when missing
  const enrichedThemeRatings = useMemo(() => {
    const coverMap = new Map<string, string>();
    animeRatings.forEach(r => {
      if (r.coverImage) coverMap.set(r.animeId, r.coverImage);
    });
    return themeRatings.map(t => {
      if (t.coverImage) return t;
      const cover = t.animeId ? coverMap.get(t.animeId) : undefined;
      return cover ? { ...t, coverImage: cover } : t;
    });
  }, [themeRatings, animeRatings]);

  // Sort theme ratings (use enriched)
  const getSortedThemes = (): ThemeRating[] => {
    const sorted = [...enrichedThemeRatings];
    switch (themeTab) {
      case 'music': return sorted.sort((a, b) => b.avgMusic - a.avgMusic);
      case 'animation': return sorted.sort((a, b) => b.avgAnimation - a.avgAnimation);
      default: return sorted.sort((a, b) => b.avgOverall - a.avgOverall);
    }
  };

  const getThemeScore = (r: ThemeRating): number => {
    switch (themeTab) {
      case 'music': return r.avgMusic;
      case 'animation': return r.avgAnimation;
      default: return r.avgOverall;
    }
  };

  // Group anime ratings by anime name (aggregate seasons)
  const getGroupedAnime = (): AnimeGroupRating[] => {
    const map = new Map<string, AnimeRating[]>();
    animeRatings.forEach(r => {
      const anime = getAnimeName(r.animeName, r.franchise);
      const existing = map.get(anime) || [];
      existing.push(r);
      map.set(anime, existing);
    });

    return Array.from(map.entries()).map(([anime, entries]) => {
      let totalWeight = 0;
      let wPlot = 0, wChars = 0, wAnim = 0, wOst = 0, wPacing = 0;
      entries.forEach(e => {
        wPlot += e.avgPlot * e.count;
        wChars += e.avgCharacters * e.count;
        wAnim += e.avgAnimation * e.count;
        wOst += e.avgOst * e.count;
        wPacing += e.avgPacing * e.count;
        totalWeight += e.count;
      });
      const avgPlot = wPlot / totalWeight;
      const avgCharacters = wChars / totalWeight;
      const avgAnimation = wAnim / totalWeight;
      const avgOst = wOst / totalWeight;
      const avgPacing = wPacing / totalWeight;
      return {
        anime,
        coverImage: entries.find(e => e.coverImage)?.coverImage,
        avgPlot, avgCharacters, avgAnimation, avgOst, avgPacing,
        avgOverall: (avgPlot + avgCharacters + avgAnimation + avgOst + avgPacing) / 5,
        totalCount: totalWeight,
        seasonCount: entries.length,
      };
    });
  };

  const getSortedGroupedAnime = (): AnimeGroupRating[] => {
    const sorted = [...getGroupedAnime()];
    switch (animeTab) {
      case 'plot': return sorted.sort((a, b) => b.avgPlot - a.avgPlot);
      case 'characters': return sorted.sort((a, b) => b.avgCharacters - a.avgCharacters);
      case 'animation': return sorted.sort((a, b) => b.avgAnimation - a.avgAnimation);
      case 'ost': return sorted.sort((a, b) => b.avgOst - a.avgOst);
      case 'pacing': return sorted.sort((a, b) => b.avgPacing - a.avgPacing);
      default: return sorted.sort((a, b) => b.avgOverall - a.avgOverall);
    }
  };

  const getGroupedScore = (r: AnimeGroupRating): number => {
    switch (animeTab) {
      case 'plot': return r.avgPlot;
      case 'characters': return r.avgCharacters;
      case 'animation': return r.avgAnimation;
      case 'ost': return r.avgOst;
      case 'pacing': return r.avgPacing;
      default: return r.avgOverall;
    }
  };

  const sortedAnime = useMemo(getSortedAnime, [animeRatings, animeTab]);
  const sortedGroupedAnime = useMemo(getSortedGroupedAnime, [animeRatings, animeTab]);
  const sortedThemes = useMemo(getSortedThemes, [enrichedThemeRatings, themeTab]);

  return (
    <div className="leaderboard-container">

      <main className="leaderboard-main">
        <div className="leaderboard-hero">
          <button className="lb-back-btn" onClick={() => navigate('/anime')}>
            <ArrowLeft size={18} />
            Accueil
          </button>
          <div className="lb-hero-icon">
            <Trophy size={40} />
          </div>
          <h1 className="lb-hero-title">
            <span className="text-gradient-cool">Classement</span>
          </h1>
          <p className="lb-hero-subtitle">
            Les mieux notés par la communauté — scores sur 100
          </p>
        </div>

        {/* View mode toggle */}
        <div className="lb-view-toggle">
          <button
            className={`lb-view-btn ${viewMode === 'anime' ? 'active' : ''}`}
            onClick={() => setViewMode('anime')}
          >
            <BarChart3 size={16} />
            Anime
          </button>
          <button
            className={`lb-view-btn ${viewMode === 'themes' ? 'active' : ''}`}
            onClick={() => setViewMode('themes')}
          >
            <Play size={16} />
            OP / ED
          </button>
        </div>

        {/* Anime sub-toggle: par anime / par saison */}
        {viewMode === 'anime' && (
          <div className="lb-view-toggle lb-sub-toggle">
            <button
              className={`lb-view-btn lb-view-btn-sm ${animeViewMode === 'anime' ? 'active' : ''}`}
              onClick={() => setAnimeViewMode('anime')}
            >
              <Layers size={14} />
              Par anime
            </button>
            <button
              className={`lb-view-btn lb-view-btn-sm ${animeViewMode === 'season' ? 'active' : ''}`}
              onClick={() => setAnimeViewMode('season')}
            >
              <BookOpen size={14} />
              Par saison
            </button>
          </div>
        )}

        {/* Sub-tabs */}
        <div className="lb-tabs">
          {viewMode === 'anime'
            ? ANIME_TABS.map(({ key, label, icon: Icon }) => (
                <button key={key} className={`lb-tab ${animeTab === key ? 'active' : ''}`} onClick={() => setAnimeTab(key)}>
                  <Icon size={14} /> {label}
                </button>
              ))
            : THEME_TABS.map(({ key, label, icon: Icon }) => (
                <button key={key} className={`lb-tab ${themeTab === key ? 'active' : ''}`} onClick={() => setThemeTab(key)}>
                  <Icon size={14} /> {label}
                </button>
              ))
          }
        </div>

        {loading ? (
          <div className="lb-loading">
            <Loader2 size={32} className="lb-spinner" />
            <p>Chargement du classement...</p>
          </div>
        ) : viewMode === 'anime' ? (
          /* ═══ ANIME VIEW ═══ */
          (animeViewMode === 'anime' ? sortedGroupedAnime : sortedAnime).length === 0 ? (
            <div className="lb-empty glass-panel">
              <Trophy size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
              <h3>Aucune note pour l'instant</h3>
              <p>Sois le premier à noter un anime !</p>
            </div>
          ) : animeViewMode === 'anime' ? (
            /* ── Par anime (groupé) ── */
            <div className="lb-list">
              {sortedGroupedAnime.length >= 3 && (
                <div className="lb-podium">
                  {[1, 0, 2].map((podiumIdx) => {
                    const r = sortedGroupedAnime[podiumIdx];
                    if (!r) return null;
                    const score = getGroupedScore(r);
                    return (
                      <div key={r.anime} className={`podium-card glass-panel podium-${podiumIdx + 1}`}>
                        <span className="podium-medal">{getMedalEmoji(podiumIdx)}</span>
                        <span className="podium-rank">#{podiumIdx + 1}</span>
                        {r.coverImage && <img src={r.coverImage} alt="" className="podium-cover" />}
                        <h4 className="podium-anime-name">{r.anime}</h4>
                        <div className={`podium-score ${getScoreColor(score)}`}>{score.toFixed(0)}</div>
                        <span className="podium-max">/100</span>
                        <div className="podium-details">
                          <span className="podium-detail" title="Scénario"><BookOpen size={10} /> {r.avgPlot.toFixed(0)}</span>
                          <span className="podium-detail" title="Personnages"><UsersIcon size={10} /> {r.avgCharacters.toFixed(0)}</span>
                          <span className="podium-detail" title="Animation"><Palette size={10} /> {r.avgAnimation.toFixed(0)}</span>
                          <span className="podium-detail" title="OST"><Music size={10} /> {r.avgOst.toFixed(0)}</span>
                          <span className="podium-detail" title="Rythme"><Timer size={10} /> {r.avgPacing.toFixed(0)}</span>
                        </div>
                        <span className="podium-votes">{r.seasonCount} saison{r.seasonCount > 1 ? 's' : ''} · {r.totalCount} vote{r.totalCount > 1 ? 's' : ''}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="lb-table">
                <div className="lb-table-header lb-anime-grid">
                  <span className="lb-col-rank">#</span>
                  <span className="lb-col-name">Anime</span>
                  <span className="lb-col-cat">Scén.</span>
                  <span className="lb-col-cat">Persos</span>
                  <span className="lb-col-cat">Anim.</span>
                  <span className="lb-col-cat">OST</span>
                  <span className="lb-col-cat">Ryth.</span>
                  <span className="lb-col-overall">Global</span>
                  <span className="lb-col-votes">Votes</span>
                </div>
                {sortedGroupedAnime.slice(sortedGroupedAnime.length >= 3 ? 3 : 0).map((r, i) => {
                  const rank = sortedGroupedAnime.length >= 3 ? i + 4 : i + 1;
                  return (
                  <div key={r.anime} className="lb-table-row lb-anime-grid" style={{ animationDelay: `${i * 0.03}s` }}>
                    <span className="lb-col-rank">{rank}</span>
                    <div className="lb-col-name">
                      {r.coverImage && <img src={r.coverImage} alt="" className="lb-row-cover" />}
                      <div className="lb-name-group">
                        <span className="lb-anime-name">{r.anime}</span>
                        {r.seasonCount > 1 && <span className="lb-season-count">{r.seasonCount} saisons</span>}
                      </div>
                    </div>
                    <span className={`lb-col-cat ${getScoreColor(r.avgPlot)}`}>{r.avgPlot.toFixed(0)}</span>
                    <span className={`lb-col-cat ${getScoreColor(r.avgCharacters)}`}>{r.avgCharacters.toFixed(0)}</span>
                    <span className={`lb-col-cat ${getScoreColor(r.avgAnimation)}`}>{r.avgAnimation.toFixed(0)}</span>
                    <span className={`lb-col-cat ${getScoreColor(r.avgOst)}`}>{r.avgOst.toFixed(0)}</span>
                    <span className={`lb-col-cat ${getScoreColor(r.avgPacing)}`}>{r.avgPacing.toFixed(0)}</span>
                    <span className={`lb-col-overall lb-overall-score ${getScoreColor(r.avgOverall)}`}>{r.avgOverall.toFixed(0)}</span>
                    <span className="lb-col-votes">{r.totalCount}</span>
                  </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ── Par saison (individuel) ── */
            <div className="lb-list">
              {sortedAnime.length >= 3 && (
                <div className="lb-podium">
                  {[1, 0, 2].map((podiumIdx) => {
                    const r = sortedAnime[podiumIdx];
                    if (!r) return null;
                    const score = getAnimeScore(r);
                    return (
                      <div key={r.animeId} className={`podium-card glass-panel podium-${podiumIdx + 1}`}>
                        <span className="podium-medal">{getMedalEmoji(podiumIdx)}</span>
                        <span className="podium-rank">#{podiumIdx + 1}</span>
                        {r.coverImage && <img src={r.coverImage} alt="" className="podium-cover" />}
                        <h4 className="podium-anime-name">{r.animeName}</h4>
                        <div className={`podium-score ${getScoreColor(score)}`}>{score.toFixed(0)}</div>
                        <span className="podium-max">/100</span>
                        <div className="podium-details">
                          <span className="podium-detail" title="Scénario"><BookOpen size={10} /> {r.avgPlot.toFixed(0)}</span>
                          <span className="podium-detail" title="Personnages"><UsersIcon size={10} /> {r.avgCharacters.toFixed(0)}</span>
                          <span className="podium-detail" title="Animation"><Palette size={10} /> {r.avgAnimation.toFixed(0)}</span>
                          <span className="podium-detail" title="OST"><Music size={10} /> {r.avgOst.toFixed(0)}</span>
                          <span className="podium-detail" title="Rythme"><Timer size={10} /> {r.avgPacing.toFixed(0)}</span>
                        </div>
                        <span className="podium-votes">{r.count} vote{r.count > 1 ? 's' : ''}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="lb-table">
                <div className="lb-table-header lb-anime-grid">
                  <span className="lb-col-rank">#</span>
                  <span className="lb-col-name">Saison</span>
                  <span className="lb-col-cat">Scén.</span>
                  <span className="lb-col-cat">Persos</span>
                  <span className="lb-col-cat">Anim.</span>
                  <span className="lb-col-cat">OST</span>
                  <span className="lb-col-cat">Ryth.</span>
                  <span className="lb-col-overall">Global</span>
                  <span className="lb-col-votes">Votes</span>
                </div>
                {sortedAnime.slice(sortedAnime.length >= 3 ? 3 : 0).map((r, i) => {
                  const rank = sortedAnime.length >= 3 ? i + 4 : i + 1;
                  return (
                  <div key={r.animeId} className="lb-table-row lb-anime-grid" style={{ animationDelay: `${i * 0.03}s` }}>
                    <span className="lb-col-rank">{rank}</span>
                    <div className="lb-col-name">
                      {r.coverImage && <img src={r.coverImage} alt="" className="lb-row-cover" />}
                      <span className="lb-anime-name">{r.animeName}</span>
                    </div>
                    <span className={`lb-col-cat ${getScoreColor(r.avgPlot)}`}>{r.avgPlot.toFixed(0)}</span>
                    <span className={`lb-col-cat ${getScoreColor(r.avgCharacters)}`}>{r.avgCharacters.toFixed(0)}</span>
                    <span className={`lb-col-cat ${getScoreColor(r.avgAnimation)}`}>{r.avgAnimation.toFixed(0)}</span>
                    <span className={`lb-col-cat ${getScoreColor(r.avgOst)}`}>{r.avgOst.toFixed(0)}</span>
                    <span className={`lb-col-cat ${getScoreColor(r.avgPacing)}`}>{r.avgPacing.toFixed(0)}</span>
                    <span className={`lb-col-overall lb-overall-score ${getScoreColor(r.avgOverall)}`}>{r.avgOverall.toFixed(0)}</span>
                    <span className="lb-col-votes">{r.count}</span>
                  </div>
                  );
                })}
              </div>
            </div>
          )
        ) : (
          /* ═══ OP/ED VIEW ═══ */
          sortedThemes.length === 0 ? (
            <div className="lb-empty glass-panel">
              <Trophy size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
              <h3>Aucune note OP/ED pour l'instant</h3>
              <p>Sois le premier à noter un opening ou ending !</p>
            </div>
          ) : (
            <div className="lb-list">
              {sortedThemes.length >= 3 && (
                <div className="lb-podium">
                  {[1, 0, 2].map((podiumIdx) => {
                    const r = sortedThemes[podiumIdx];
                    if (!r) return null;
                    const score = getThemeScore(r);
                    return (
                      <div key={r.themeId} className={`podium-card glass-panel podium-${podiumIdx + 1} podium-clickable`} onClick={() => handleThemeClick(r.themeId)}>
                        <span className="podium-medal">{getMedalEmoji(podiumIdx)}</span>
                        <span className="podium-rank">#{podiumIdx + 1}</span>
                        {r.coverImage && <img src={r.coverImage} alt="" className="podium-cover" />}
                        <div className="podium-theme-type">{r.themeType}</div>
                        <h4 className="podium-anime-name">{r.animeName}</h4>
                        <div className={`podium-score ${getScoreColor(score)}`}>{score.toFixed(0)}</div>
                        <span className="podium-max">/100</span>
                        <div className="podium-details">
                          <span className="podium-detail" title="Musique"><Music size={10} /> {r.avgMusic.toFixed(0)}</span>
                          <span className="podium-detail" title="Animation"><Palette size={10} /> {r.avgAnimation.toFixed(0)}</span>
                        </div>
                        <span className="podium-votes">{r.count} vote{r.count > 1 ? 's' : ''}</span>
                        {loadingThemeId === r.themeId && <Loader2 size={16} className="lb-spinner podium-loader" />}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="lb-table">
                <div className="lb-table-header lb-theme-grid">
                  <span className="lb-col-rank">#</span>
                  <span className="lb-col-name">OP / ED</span>
                  <span className="lb-col-cat">Musique</span>
                  <span className="lb-col-cat">Anim.</span>
                  <span className="lb-col-overall">Global</span>
                  <span className="lb-col-votes">Votes</span>
                </div>
                {sortedThemes.slice(sortedThemes.length >= 3 ? 3 : 0).map((r, i) => {
                  const rank = sortedThemes.length >= 3 ? i + 4 : i + 1;
                  return (
                  <div key={r.themeId} className="lb-table-row lb-theme-grid lb-theme-row" style={{ animationDelay: `${i * 0.03}s` }} onClick={() => handleThemeClick(r.themeId)}>
                    <span className="lb-col-rank">{rank}</span>
                    <div className="lb-col-name">
                      <span className="lb-theme-badge">{r.themeType}</span>
                      <span className="lb-anime-name">{r.animeName}</span>
                      {loadingThemeId === r.themeId && <Loader2 size={14} className="lb-spinner" />}
                    </div>
                    <span className={`lb-col-cat ${getScoreColor(r.avgMusic)}`}>{r.avgMusic.toFixed(0)}</span>
                    <span className={`lb-col-cat ${getScoreColor(r.avgAnimation)}`}>{r.avgAnimation.toFixed(0)}</span>
                    <span className={`lb-col-overall lb-overall-score ${getScoreColor(r.avgOverall)}`}>{r.avgOverall.toFixed(0)}</span>
                    <span className="lb-col-votes">{r.count}</span>
                  </div>
                  );
                })}
              </div>
            </div>
          )
        )}

        {/* ═══ Theme Video Player Modal ═══ */}
        {playingTheme && (
          <div className="lb-video-overlay" onClick={handleClosePlayer}>
            <div className="lb-video-modal glass-panel" onClick={e => e.stopPropagation()}>
              <button className="lb-video-close" onClick={handleClosePlayer}><X size={18} /></button>
              <div className="lb-video-info">
                <span className="lb-video-type">{playingTheme.type}{playingTheme.sequence || ''}</span>
                <h3 className="lb-video-anime">{playingTheme.animeName}</h3>
                {playingTheme.songTitle && (
                  <p className="lb-video-song">
                    🎵 {playingTheme.songTitle}
                    {playingTheme.artistName && <span className="lb-video-artist"> — {playingTheme.artistName}</span>}
                  </p>
                )}
              </div>
              <video
                key={playingTheme.videoLink!}
                controls
                autoPlay
                className="lb-video-player"
                poster={playingTheme.coverImage || undefined}
              >
                <source src={playingTheme.videoLink!} type="video/webm" />
              </video>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
