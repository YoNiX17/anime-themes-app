import { useEffect, useState, useRef } from 'react';
import { ref, onValue, set, remove, get } from 'firebase/database';
import {
  User as UserIcon, Camera, BookOpen, Palette, Music, Timer, Trash2,
  Users as UsersIcon, Edit3, Save, ArrowLeft, Play, Loader2, X, Share2,
  BarChart3, TrendingUp, Film, Tv
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { getAnimeName } from '../utils/animeGrouping';
import { refreshAnimeRatingMeta, refreshThemeRatingMeta } from '../utils/ratingMeta';
import './Profile.css';

/* ═══ Regroupement par anime ═══ */

/* ═══ Types ═══ */

interface UserAnimeRating {
  id: string;
  animeName: string;
  plot: number;
  characters: number;
  animation: number;
  ost: number;
  pacing: number;
  timestamp: number;
  coverImage?: string;
  franchise?: string;
}

interface UserThemeRating {
  id: string;
  animeName: string;
  themeType: string;
  themeSlug: string;
  music: number;
  animation: number;
  timestamp: number;
}

interface AnimeGroup {
  anime: string;
  entries: UserAnimeRating[];
  avgPlot: number;
  avgCharacters: number;
  avgAnimation: number;
  avgOst: number;
  avgPacing: number;
  avgOverall: number;
  latestCover?: string;
}

/* ═══ EditModal ═══ */
interface EditModalProps {
  mode: 'anime' | 'theme';
  item: UserAnimeRating | UserThemeRating;
  onSave: (scores: Record<string, number>) => void;
  onClose: () => void;
}

const ANIME_CATS = [
  { key: 'plot', label: 'Scénario', icon: BookOpen, color: '#8b5cf6' },
  { key: 'characters', label: 'Personnages', icon: UsersIcon, color: '#06d6a0' },
  { key: 'animation', label: 'Animation', icon: Palette, color: '#f72585' },
  { key: 'ost', label: 'OST', icon: Music, color: '#fbbf24' },
  { key: 'pacing', label: 'Rythme', icon: Timer, color: '#06b6d4' },
];

const THEME_CATS = [
  { key: 'music', label: 'Musique', icon: Music, color: '#f72585' },
  { key: 'animation', label: 'Animation', icon: Palette, color: '#06b6d4' },
];

const EditModal: React.FC<EditModalProps> = ({ mode, item, onSave, onClose }) => {
  const cats = mode === 'anime' ? ANIME_CATS : THEME_CATS;
  const [scores, setScores] = useState<Record<string, number>>(() => {
    const s: Record<string, number> = {};
    cats.forEach(c => { s[c.key] = (item as any)[c.key] || 50; });
    return s;
  });

  const overall = Math.round(
    cats.reduce((sum, c) => sum + (scores[c.key] || 0), 0) / cats.length
  );

  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal glass-panel" onClick={e => e.stopPropagation()}>
        <button className="profile-modal-close" onClick={onClose}><X size={18} /></button>
        <h3>Modifier — {mode === 'anime' ? (item as UserAnimeRating).animeName : `${(item as UserThemeRating).themeType} — ${(item as UserThemeRating).animeName}`}</h3>
        <div className="edit-cats">
          {cats.map(({ key, label, icon: Icon, color }) => (
            <div key={key} className="edit-cat-row">
              <div className="edit-cat-label" style={{ color }}><Icon size={14} /> {label}</div>
              <div className="edit-cat-slider">
                <input type="range" min={0} max={100} value={scores[key]}
                  onChange={e => setScores(prev => ({ ...prev, [key]: Number(e.target.value) }))} />
                <span className="edit-cat-val" style={{ color }}>{scores[key]}</span>
                <span className="edit-cat-max">/100</span>
              </div>
            </div>
          ))}
        </div>
        <div className="edit-footer">
          <span className="edit-overall">Global : {overall}/100</span>
          <button className="edit-save-btn" onClick={() => onSave(scores)}>
            <Save size={16} /> Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═══ Profile Page ═══ */

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [animeRatings, setAnimeRatings] = useState<UserAnimeRating[]>([]);
  const [themeRatings, setThemeRatings] = useState<UserThemeRating[]>([]);
  const [movieCount, setMovieCount] = useState(0);
  const [seriesCount, setSeriesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<{ mode: 'anime' | 'theme'; item: UserAnimeRating | UserThemeRating } | null>(null);
  const [viewMode, setViewMode] = useState<'anime' | 'themes' | 'stats'>('anime');
  const [groupByAnime, setGroupByAnime] = useState(true);
  const [themeFilter, setThemeFilter] = useState<'all' | 'OP' | 'ED'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) { navigate('/anime'); return; }

    // Fetch avatar
    const avatarRef = ref(db, `users/${user.uid}/profile/avatarUrl`);
    const unsubAvatar = onValue(avatarRef, (snap) => {
      setAvatarUrl(snap.exists() ? snap.val() : null);
    });

    // Fetch anime ratings
    const animeRef = ref(db, `users/${user.uid}/ratings`);
    const unsubAnime = onValue(animeRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const arr: UserAnimeRating[] = Object.entries(data).map(([id, d]: [string, any]) => ({
          id,
          animeName: d.animeName || `Anime #${id}`,
          plot: d.plot || 0,
          characters: d.characters || 0,
          animation: d.animation || 0,
          ost: d.ost || 0,
          pacing: d.pacing || 0,
          timestamp: d.timestamp || 0,
          coverImage: d.coverImage || undefined,
          franchise: d.franchise || undefined,
        }));
        arr.sort((a, b) => b.timestamp - a.timestamp);
        setAnimeRatings(arr);
      } else {
        setAnimeRatings([]);
      }
      setLoading(false);
    });

    // Fetch theme ratings
    const themeRef = ref(db, `users/${user.uid}/themeRatings`);
    const unsubTheme = onValue(themeRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const arr: UserThemeRating[] = Object.entries(data).map(([id, d]: [string, any]) => ({
          id,
          animeName: d.animeName || 'Inconnu',
          themeType: d.themeType || 'OP',
          themeSlug: d.themeSlug || '',
          music: d.music || 0,
          animation: d.animation || 0,
          timestamp: d.timestamp || 0,
        }));
        arr.sort((a, b) => b.timestamp - a.timestamp);
        setThemeRatings(arr);
      } else {
        setThemeRatings([]);
      }
    });

    return () => { unsubAvatar(); unsubAnime(); unsubTheme(); };
  }, [user, navigate]);

  // Fetch movie/series counts for stats
  useEffect(() => {
    if (!user) return;
    get(ref(db, `users/${user.uid}/movieRatings`)).then(snap => {
      setMovieCount(snap.exists() ? Object.keys(snap.val()).length : 0);
    });
    get(ref(db, `users/${user.uid}/seriesRatings`)).then(snap => {
      setSeriesCount(snap.exists() ? Object.keys(snap.val()).length : 0);
    });
  }, [user]);

  // ── Avatar upload (base64 in RTDB) ──
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      showToast("Format non supporté (JPG, PNG ou WebP).", "error");
      return;
    }
    if (file.size > 200_000) {
      showToast("Image trop lourde (max 200 Ko).", "error");
      return;
    }
    // Validate it's a real image by loading it
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      if (img.width < 50 || img.height < 50 || img.width > 4096 || img.height > 4096) {
        showToast("Dimensions invalides (50-4096px).", "error");
        return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        if (!dataUrl.startsWith('data:image/')) {
          showToast("Fichier invalide.", "error");
          return;
        }
        await set(ref(db, `users/${user.uid}/profile/avatarUrl`), dataUrl);
        showToast("Photo de profil mise à jour !", "success");
      };
      reader.readAsDataURL(file);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      showToast("Fichier image invalide.", "error");
    };
    img.src = objectUrl;
  };

  // ── Delete rating ──
  const handleDeleteAnimeRating = async (itemId: string) => {
    if (!user) return;
    await remove(ref(db, `users/${user.uid}/ratings/${itemId}`));
    await remove(ref(db, `ratings/${itemId}/users/${user.uid}`));
    await refreshAnimeRatingMeta(itemId);
    showToast("Note saison supprim\u00e9e.", "info");
  };

  const handleDeleteThemeRating = async (itemId: string) => {
    if (!user) return;
    await remove(ref(db, `users/${user.uid}/themeRatings/${itemId}`));
    await remove(ref(db, `themeRatings/${itemId}/users/${user.uid}`));
    await refreshThemeRatingMeta(itemId);
    showToast("Note OP/ED supprimée.", "info");
  };

  // ── Edit rating ──
  const handleSaveEdit = async (scores: Record<string, number>) => {
    if (!user || !editingItem) return;
    const { mode, item } = editingItem;
    const dbKey = mode === 'anime' ? 'ratings' : 'themeRatings';
    const globalKey = mode === 'anime' ? 'ratings' : 'themeRatings';

    // Update user's personal copy
    const existing = (await get(ref(db, `users/${user.uid}/${dbKey}/${item.id}`))).val() || {};
    await set(ref(db, `users/${user.uid}/${dbKey}/${item.id}`), { ...existing, ...scores, timestamp: Date.now() });
    // Update global
    await set(ref(db, `${globalKey}/${item.id}/users/${user.uid}`), scores);
    // Refresh aggregated meta
    if (mode === 'anime') {
      await refreshAnimeRatingMeta(item.id);
    } else {
      await refreshThemeRatingMeta(item.id);
    }
    showToast("Note mise à jour !", "success");
    setEditingItem(null);
  };

  // ── Regroupement par anime ──
  const getAnimeGroups = (): AnimeGroup[] => {
    const map = new Map<string, UserAnimeRating[]>();
    animeRatings.forEach(r => {
      const anime = getAnimeName(r.animeName, r.franchise);
      const existing = map.get(anime) || [];
      existing.push(r);
      map.set(anime, existing);
    });

    return Array.from(map.entries()).map(([anime, entries]) => {
      const n = entries.length;
      const avgPlot = entries.reduce((s, e) => s + e.plot, 0) / n;
      const avgCharacters = entries.reduce((s, e) => s + e.characters, 0) / n;
      const avgAnimation = entries.reduce((s, e) => s + e.animation, 0) / n;
      const avgOst = entries.reduce((s, e) => s + e.ost, 0) / n;
      const avgPacing = entries.reduce((s, e) => s + e.pacing, 0) / n;
      return {
        anime,
        entries,
        avgPlot, avgCharacters, avgAnimation, avgOst, avgPacing,
        avgOverall: (avgPlot + avgCharacters + avgAnimation + avgOst + avgPacing) / 5,
        latestCover: entries.find(e => e.coverImage)?.coverImage,
      };
    }).sort((a, b) => b.avgOverall - a.avgOverall);
  };

  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'score-legendary';
    if (score >= 75) return 'score-excellent';
    if (score >= 50) return 'score-good';
    if (score >= 30) return 'score-average';
    return 'score-low';
  };

  if (!user) return null;

  const displayName = user.displayName || user.email?.split('@')[0] || 'Utilisateur';
  const animeCount = animeRatings.length;
  const themeCount = themeRatings.length;
  const animeGroups = groupByAnime ? getAnimeGroups() : null;

  return (
    <div className="profile-container">

      <main className="profile-main">
        {/* Hero / User info */}
        <div className="profile-hero glass-panel">
          <button className="profile-back-btn" onClick={() => navigate('/anime')}>
            <ArrowLeft size={18} /> Accueil
          </button>

          <div className="profile-avatar-section">
            <div className="profile-avatar" onClick={() => fileInputRef.current?.click()}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="avatar-img" />
              ) : (
                <UserIcon size={40} />
              )}
              <div className="avatar-overlay">
                <Camera size={20} />
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden-file-input"
              onChange={handleAvatarUpload}
            />
          </div>

          <h2 className="profile-name">{displayName}</h2>
          <p className="profile-email">{user.email}</p>

          <button
            className="profile-share-btn"
            onClick={() => {
              const url = `${window.location.origin}/profil/${user.uid}`;
              navigator.clipboard.writeText(url).then(() => {
                showToast("Lien du profil copié !", "success");
              });
            }}
          >
            <Share2 size={14} /> Partager mon profil
          </button>

          <div className="profile-stats">
            <div className="stat-card">
              <span className="stat-value">{animeCount}</span>
              <span className="stat-label">Saisons notées</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{themeCount}</span>
              <span className="stat-label">OP/ED notés</span>
            </div>
            {animeGroups && (
              <div className="stat-card">
                <span className="stat-value">{animeGroups.length}</span>
                <span className="stat-label">Anime</span>
              </div>
            )}
          </div>
        </div>

        {/* View toggle */}
        <div className="profile-view-toggle">
          <button className={`pv-btn ${viewMode === 'anime' ? 'active' : ''}`} onClick={() => setViewMode('anime')}>
            <BookOpen size={16} /> Mes Saisons
          </button>
          <button className={`pv-btn ${viewMode === 'themes' ? 'active' : ''}`} onClick={() => setViewMode('themes')}>
            <Play size={16} /> Mes OP/ED
          </button>
          <button className={`pv-btn ${viewMode === 'stats' ? 'active' : ''}`} onClick={() => setViewMode('stats')}>
            <BarChart3 size={16} /> Stats
          </button>
        </div>

        {loading ? (
          <div className="profile-loading">
            <Loader2 size={32} className="profile-spinner" />
            <p>Chargement...</p>
          </div>
        ) : viewMode === 'anime' ? (
          /* ═══ ANIME RATINGS ═══ */
          <div className="profile-ratings-section">
            <div className="profile-section-header">
              <h3>Mes saisons ({animeCount})</h3>
              {animeCount > 1 && (
                <button className="group-toggle-btn" onClick={() => setGroupByAnime(!groupByAnime)}>
                  {groupByAnime ? 'Par saison' : 'Par anime'}
                </button>
              )}
            </div>

            {animeCount === 0 ? (
              <div className="profile-empty glass-panel">
                <BookOpen size={40} style={{ color: 'var(--text-muted)' }} />
                <p>Tu n'as encore noté aucune saison.</p>
              </div>
            ) : groupByAnime && animeGroups ? (
              /* Vue groupée par anime */
              <div className="franchise-list">
                {animeGroups.map(f => (
                  <div key={f.anime} className="franchise-card glass-panel">
                    <div className="franchise-header">
                      {f.latestCover && <img src={f.latestCover} alt="" className="franchise-cover" />}
                      <div className="franchise-info">
                        <h4 className="franchise-name">{f.anime}</h4>
                        <span className="franchise-count">{f.entries.length} saison{f.entries.length > 1 ? 's' : ''}</span>
                      </div>
                      <div className={`franchise-score ${getScoreColor(f.avgOverall)}`}>
                        {f.avgOverall.toFixed(0)}<span className="franchise-max">/100</span>
                      </div>
                    </div>
                    <div className="franchise-cats">
                      <span style={{ color: '#8b5cf6' }}><BookOpen size={11} /> {f.avgPlot.toFixed(0)}</span>
                      <span style={{ color: '#06d6a0' }}><UsersIcon size={11} /> {f.avgCharacters.toFixed(0)}</span>
                      <span style={{ color: '#f72585' }}><Palette size={11} /> {f.avgAnimation.toFixed(0)}</span>
                      <span style={{ color: '#fbbf24' }}><Music size={11} /> {f.avgOst.toFixed(0)}</span>
                      <span style={{ color: '#06b6d4' }}><Timer size={11} /> {f.avgPacing.toFixed(0)}</span>
                    </div>
                    <div className="franchise-entries">
                      {f.entries.map(r => {
                        const overall = Math.round((r.plot + r.characters + r.animation + r.ost + r.pacing) / 5);
                        return (
                          <div key={r.id} className="franchise-entry">
                            <span className="entry-name">{r.animeName}</span>
                            <span className={`entry-score ${getScoreColor(overall)}`}>{overall}</span>
                            <button className="entry-edit-btn" onClick={() => setEditingItem({ mode: 'anime', item: r })}><Edit3 size={13} /></button>
                            <button className="entry-delete-btn" onClick={() => handleDeleteAnimeRating(r.id)}><Trash2 size={13} /></button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Flat list */
              <div className="ratings-list">
                {animeRatings.map(r => {
                  const overall = Math.round((r.plot + r.characters + r.animation + r.ost + r.pacing) / 5);
                  return (
                    <div key={r.id} className="rating-row glass-panel">
                      {r.coverImage && <img src={r.coverImage} alt="" className="rating-row-cover" />}
                      <div className="rating-row-info">
                        <span className="rating-row-name">{r.animeName}</span>
                        <div className="rating-row-cats">
                          <span style={{ color: '#8b5cf6' }}>{r.plot}</span>
                          <span style={{ color: '#06d6a0' }}>{r.characters}</span>
                          <span style={{ color: '#f72585' }}>{r.animation}</span>
                          <span style={{ color: '#fbbf24' }}>{r.ost}</span>
                          <span style={{ color: '#06b6d4' }}>{r.pacing}</span>
                        </div>
                      </div>
                      <div className={`rating-row-overall ${getScoreColor(overall)}`}>{overall}</div>
                      <div className="rating-row-actions">
                        <button onClick={() => setEditingItem({ mode: 'anime', item: r })}><Edit3 size={14} /></button>
                        <button onClick={() => handleDeleteAnimeRating(r.id)}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : viewMode === 'themes' ? (
          /* ═══ THEME RATINGS ═══ */
          <div className="profile-ratings-section">
            <div className="profile-section-header">
              <h3>Mes notes OP/ED ({themeCount})</h3>
              <div className="theme-filter-toggle">
                <button className={`theme-filter-btn ${themeFilter === 'all' ? 'active' : ''}`} onClick={() => setThemeFilter('all')}>Tous</button>
                <button className={`theme-filter-btn ${themeFilter === 'OP' ? 'active' : ''}`} onClick={() => setThemeFilter('OP')}>OP</button>
                <button className={`theme-filter-btn ${themeFilter === 'ED' ? 'active' : ''}`} onClick={() => setThemeFilter('ED')}>ED</button>
              </div>
            </div>

            {themeCount === 0 ? (
              <div className="profile-empty glass-panel">
                <Play size={40} style={{ color: 'var(--text-muted)' }} />
                <p>Tu n'as encore noté aucun OP/ED.</p>
              </div>
            ) : (() => {
              const filtered = themeFilter === 'all'
                ? themeRatings
                : themeRatings.filter(r => r.themeType.startsWith(themeFilter));
              const sorted = [...filtered].sort((a, b) => {
                const avgA = (a.music + a.animation) / 2;
                const avgB = (b.music + b.animation) / 2;
                return avgB - avgA;
              });
              if (sorted.length === 0) {
                return (
                  <div className="profile-empty glass-panel">
                    <Play size={40} style={{ color: 'var(--text-muted)' }} />
                    <p>Aucun {themeFilter} noté.</p>
                  </div>
                );
              }
              return (
                <div className="ratings-list">
                  {sorted.map((r, i) => {
                    const overall = Math.round((r.music + r.animation) / 2);
                    return (
                      <div key={r.id} className="rating-row glass-panel">
                        <span className="rating-row-rank">{i + 1}</span>
                        <div className="rating-row-info">
                          <div className="rating-row-name-group">
                            <span className="rating-row-theme-badge">{r.themeType}</span>
                            <span className="rating-row-name">{r.animeName}</span>
                          </div>
                          <div className="rating-row-cats">
                            <span style={{ color: '#f72585' }}><Music size={11} /> {r.music}</span>
                            <span style={{ color: '#06b6d4' }}><Palette size={11} /> {r.animation}</span>
                          </div>
                        </div>
                        <div className={`rating-row-overall ${getScoreColor(overall)}`}>{overall}</div>
                        <div className="rating-row-actions">
                          <button onClick={() => setEditingItem({ mode: 'theme', item: r })}><Edit3 size={14} /></button>
                          <button onClick={() => handleDeleteThemeRating(r.id)}><Trash2 size={14} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        ) : viewMode === 'stats' ? (
          /* ═══ STATS ═══ */
          (() => {
            const catAvg = (key: keyof UserAnimeRating) => {
              if (animeCount === 0) return 0;
              return Math.round(animeRatings.reduce((s, r) => s + ((r as any)[key] || 0), 0) / animeCount);
            };
            const globalAnimeAvg = animeCount > 0
              ? Math.round(animeRatings.reduce((s, r) => s + (r.plot + r.characters + r.animation + r.ost + r.pacing) / 5, 0) / animeCount)
              : 0;
            const globalThemeAvg = themeCount > 0
              ? Math.round(themeRatings.reduce((s, r) => s + (r.music + r.animation) / 2, 0) / themeCount)
              : 0;

            const distribution = [0, 0, 0, 0, 0];
            animeRatings.forEach(r => {
              const avg = (r.plot + r.characters + r.animation + r.ost + r.pacing) / 5;
              distribution[Math.min(Math.floor(avg / 20), 4)]++;
            });
            const maxDist = Math.max(...distribution, 1);

            const sortedByScore = [...animeRatings].sort((a, b) => {
              const avgA = (a.plot + a.characters + a.animation + a.ost + a.pacing) / 5;
              const avgB = (b.plot + b.characters + b.animation + b.ost + b.pacing) / 5;
              return avgB - avgA;
            });
            const best = sortedByScore[0] || null;
            const worst = sortedByScore.length > 1 ? sortedByScore[sortedByScore.length - 1] : null;

            const catMeta = [
              { key: 'plot', label: 'Scénario', color: '#8b5cf6', icon: BookOpen },
              { key: 'characters', label: 'Personnages', color: '#06d6a0', icon: UsersIcon },
              { key: 'animation', label: 'Animation', color: '#f72585', icon: Palette },
              { key: 'ost', label: 'OST', color: '#fbbf24', icon: Music },
              { key: 'pacing', label: 'Rythme', color: '#06b6d4', icon: Timer },
            ];

            return (
              <div className="profile-stats-section">
                {/* Totaux */}
                <div className="pstats-grid">
                  <div className="pstats-card glass-panel">
                    <Play size={18} style={{ color: '#8b5cf6' }} />
                    <span className="pstats-val">{animeCount}</span>
                    <span className="pstats-lbl">Saisons</span>
                  </div>
                  <div className="pstats-card glass-panel">
                    <Music size={18} style={{ color: '#f72585' }} />
                    <span className="pstats-val">{themeCount}</span>
                    <span className="pstats-lbl">OP/ED</span>
                  </div>
                  <div className="pstats-card glass-panel">
                    <Film size={18} style={{ color: '#e63946' }} />
                    <span className="pstats-val">{movieCount}</span>
                    <span className="pstats-lbl">Films</span>
                  </div>
                  <div className="pstats-card glass-panel">
                    <Tv size={18} style={{ color: '#3a86ff' }} />
                    <span className="pstats-val">{seriesCount}</span>
                    <span className="pstats-lbl">Séries</span>
                  </div>
                </div>

                {/* Moyennes globales */}
                {(animeCount > 0 || themeCount > 0) && (
                  <div className="pstats-averages glass-panel">
                    <h3><TrendingUp size={16} /> Moyennes globales</h3>
                    <div className="pstats-avg-row">
                      {animeCount > 0 && (
                        <div className="pstats-avg-item">
                          <span className="pstats-avg-val" style={{ color: '#8b5cf6' }}>{globalAnimeAvg}</span>
                          <span className="pstats-avg-lbl">Anime</span>
                        </div>
                      )}
                      {themeCount > 0 && (
                        <div className="pstats-avg-item">
                          <span className="pstats-avg-val" style={{ color: '#f72585' }}>{globalThemeAvg}</span>
                          <span className="pstats-avg-lbl">OP/ED</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Barres par catégorie */}
                {animeCount > 0 && (
                  <div className="pstats-breakdown glass-panel">
                    <h3><BarChart3 size={16} /> Notes par catégorie</h3>
                    <div className="pstats-bars">
                      {catMeta.map(c => {
                        const val = catAvg(c.key as keyof UserAnimeRating);
                        return (
                          <div key={c.key} className="pstats-bar-row">
                            <div className="pstats-bar-label" style={{ color: c.color }}>
                              <c.icon size={13} /> {c.label}
                            </div>
                            <div className="pstats-bar-track">
                              <div className="pstats-bar-fill" style={{ width: `${val}%`, background: c.color }} />
                            </div>
                            <span className="pstats-bar-val" style={{ color: c.color }}>{val}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Distribution */}
                {animeCount > 2 && (
                  <div className="pstats-dist glass-panel">
                    <h3><BarChart3 size={16} /> Distribution des notes</h3>
                    <div className="pstats-dist-chart">
                      {['0-20', '20-40', '40-60', '60-80', '80-100'].map((label, i) => (
                        <div key={label} className="pstats-dist-col">
                          <div className="pstats-dist-bar-wrap">
                            <div className="pstats-dist-bar" style={{ height: `${(distribution[i] / maxDist) * 100}%` }} />
                          </div>
                          <span className="pstats-dist-count">{distribution[i]}</span>
                          <span className="pstats-dist-label">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Best & worst */}
                {best && (
                  <div className="pstats-extremes glass-panel">
                    <div className="pstats-extreme">
                      <span className="pstats-ext-label">🏆 Meilleure note</span>
                      <span className="pstats-ext-name">{best.animeName}</span>
                      <span className={`pstats-ext-score ${getScoreColor(Math.round((best.plot + best.characters + best.animation + best.ost + best.pacing) / 5))}`}>
                        {Math.round((best.plot + best.characters + best.animation + best.ost + best.pacing) / 5)}/100
                      </span>
                    </div>
                    {worst && worst.id !== best.id && (
                      <div className="pstats-extreme">
                        <span className="pstats-ext-label">📉 Plus basse note</span>
                        <span className="pstats-ext-name">{worst.animeName}</span>
                        <span className={`pstats-ext-score ${getScoreColor(Math.round((worst.plot + worst.characters + worst.animation + worst.ost + worst.pacing) / 5))}`}>
                          {Math.round((worst.plot + worst.characters + worst.animation + worst.ost + worst.pacing) / 5)}/100
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {animeCount === 0 && themeCount === 0 && (
                  <div className="profile-empty glass-panel">
                    <BarChart3 size={40} style={{ color: 'var(--text-muted)' }} />
                    <p>Pas encore assez de données pour les statistiques.</p>
                  </div>
                )}
              </div>
            );
          })()
        ) : null}
      </main>

      {editingItem && (
        <EditModal
          mode={editingItem.mode}
          item={editingItem.item}
          onSave={handleSaveEdit}
          onClose={() => setEditingItem(null)}
        />
      )}
    </div>
  );
};
