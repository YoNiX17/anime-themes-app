import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Star, Users, Tv, Clock, BookOpen, Film,
  Play, ExternalLink, Music, Palette, Clapperboard, Sparkles, ChevronRight, Trophy, CheckCircle
} from 'lucide-react';
import { ref, get } from 'firebase/database';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Header } from '../components/Header';
import { ThemePlayerModal } from '../components/ThemePlayerModal';
import { RatingControl } from '../components/RatingControl';
import { Loader } from '../components/Loader';
import {
  searchAnime, findMalId,
  fetchJikanAnimeDetail, fetchJikanStaff, fetchJikanCharacters, fetchJikanRecommendations,
} from '../services/api';
import type {
  Anime, JikanAnimeDetail, JikanStaffEntry, JikanCharacterEntry, JikanRecommendation
} from '../services/api';
import { getAnimeName } from '../utils/animeGrouping';
import './AnimeDetail.css';

const STATUS_FR: Record<string, string> = {
  'Finished Airing': 'Terminé',
  'Currently Airing': 'En cours',
  'Not yet aired': 'Pas encore diffusé',
};

const SEASON_FR: Record<string, string> = {
  winter: 'Hiver', spring: 'Printemps', summer: 'Été', fall: 'Automne',
};

export const AnimeDetail: React.FC = () => {
  const { name } = useParams<{ name: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [anime, setAnime] = useState<Anime | null>(null);
  const [detail, setDetail] = useState<JikanAnimeDetail | null>(null);
  const [staff, setStaff] = useState<JikanStaffEntry[]>([]);
  const [characters, setCharacters] = useState<JikanCharacterEntry[]>([]);
  const [recommendations, setRecommendations] = useState<JikanRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPlayer, setShowPlayer] = useState(false);
  const [hasUserRating, setHasUserRating] = useState(false);

  useEffect(() => {
    if (!name) return;
    const decodedName = decodeURIComponent(name);
    loadAnimeData(decodedName);
  }, [name]);

  // Check if user has already rated this anime
  useEffect(() => {
    if (!user || !anime) {
      setHasUserRating(false);
      return;
    }
    get(ref(db, `users/${user.uid}/ratings/${anime.id}`)).then((snapshot) => {
      setHasUserRating(snapshot.exists());
    });
  }, [user, anime]);

  const loadAnimeData = async (animeName: string) => {
    setLoading(true);

    // Step 1: Search AnimeThemes for the anime (to get themes/videos)
    const results = await searchAnime(animeName);
    const matched = results[0] || null;
    setAnime(matched);

    // Step 2: Find MAL ID and fetch Jikan details
    const malIdParam = searchParams.get('mal');
    let malId = malIdParam ? parseInt(malIdParam, 10) : null;

    if (!malId) {
      malId = await findMalId(animeName);
    }

    if (malId) {
      // Fetch all Jikan data in parallel, with delays to respect rate limit (3/s)
      const detailData = await fetchJikanAnimeDetail(malId);
      setDetail(detailData);

      // Stagger subsequent requests by ~400ms to avoid rate limiting
      const [staffData, charsData, recsData] = await Promise.all([
        new Promise<JikanStaffEntry[]>(r => setTimeout(async () => r(await fetchJikanStaff(malId!)), 400)),
        new Promise<JikanCharacterEntry[]>(r => setTimeout(async () => r(await fetchJikanCharacters(malId!)), 800)),
        new Promise<JikanRecommendation[]>(r => setTimeout(async () => r(await fetchJikanRecommendations(malId!)), 1200)),
      ]);
      setStaff(staffData);
      setCharacters(charsData);
      setRecommendations(recsData);
    }

    setLoading(false);
  };

  const handleRecommendationClick = (rec: JikanRecommendation) => {
    navigate(`/anime/${encodeURIComponent(rec.entry.title)}?mal=${rec.entry.mal_id}`);
  };

  const handleRelationClick = (name: string, malId: number) => {
    navigate(`/anime/${encodeURIComponent(name)}?mal=${malId}`);
  };

  // Key staff: directors, composers, sound directors
  const keyStaff = staff.filter(s =>
    s.positions.some(p =>
      /director|music|composer|sound/i.test(p) && !/animation director|assistant|episode/i.test(p)
    )
  ).slice(0, 8);

  const mainCharacters = characters.filter(c => c.role === 'Main').slice(0, 8);
  const supportCharacters = characters.filter(c => c.role === 'Supporting').slice(0, 4);
  const displayChars = [...mainCharacters, ...supportCharacters].slice(0, 8);

  // Compute franchise name from Jikan relations (look for Prequel/Parent/Adaptation chain root)
  const computeFranchise = (): string | undefined => {
    if (!detail) return undefined;
    // If it has a prequel or parent story, it's part of a franchise
    const parentRel = detail.relations.find(r =>
      r.relation === 'Prequel' || r.relation === 'Parent story'
    );
    if (parentRel) {
      // The parent's name is a better franchise root
      const parent = parentRel.entry.find(e => e.type === 'anime');
      if (parent) return getAnimeName(parent.name);
    }
    // If it has sequels, use own name as franchise root
    const hasSequel = detail.relations.some(r =>
      r.relation === 'Sequel' || r.relation === 'Side story' || r.relation === 'Spin-off'
    );
    if (hasSequel) return getAnimeName(detail.title);
    return undefined;
  };
  const franchise = computeFranchise();

  const coverImage = anime?.images?.find(i => i.facet === 'Large Cover')?.link
    || anime?.images?.find(i => i.facet === 'Small Cover')?.link
    || detail?.images?.webp?.large_image_url
    || detail?.images?.jpg?.large_image_url;

  const RELATION_FR: Record<string, string> = {
    'Sequel': 'Suite', 'Prequel': 'Préquel', 'Alternative setting': 'Univers alternatif',
    'Alternative version': 'Version alternative', 'Side story': 'Histoire parallèle',
    'Summary': 'Résumé', 'Full story': 'Histoire complète', 'Parent story': 'Histoire principale',
    'Spin-off': 'Spin-off', 'Adaptation': 'Adaptation', 'Character': 'Personnage', 'Other': 'Autre',
  };

  if (loading) {
    return (
      <div className="detail-container">
        <Header onSearch={(q) => navigate(`/anime/${encodeURIComponent(q)}`)} />
        <Loader />
      </div>
    );
  }

  if (!anime && !detail) {
    return (
      <div className="detail-container">
        <Header onSearch={(q) => navigate(`/anime/${encodeURIComponent(q)}`)} />
        <main className="detail-main">
          <div className="detail-empty glass-panel">
            <Sparkles size={32} />
            <p>Anime introuvable.</p>
            <button className="detail-back-btn" onClick={() => navigate('/')}>
              <ArrowLeft size={16} /> Retour
            </button>
          </div>
        </main>
      </div>
    );
  }

  const title = detail?.title || anime?.name || '';
  const titleEn = detail?.title_english;
  const rawSynopsis = detail?.synopsis || anime?.synopsis || '';
  // Clean MAL rewrite tags
  const synopsis = rawSynopsis
    .replace(/\s*\[Written by MAL Rewrite\]\s*/gi, '')
    .replace(/\s*\(Source:.*?\)\s*/gi, '')
    .trim();

  return (
    <div className="detail-container">
      <Header onSearch={(q) => navigate(`/anime/${encodeURIComponent(q)}`)} />

      {/* ===== HERO BANNER ===== */}
      <section className="detail-hero">
        <div className="detail-hero-bg" style={{ backgroundImage: coverImage ? `url(${coverImage})` : undefined }} />
        <div className="detail-hero-content">
          <button className="detail-back-btn" onClick={() => navigate(-1 as any)}>
            <ArrowLeft size={16} /> Retour
          </button>

          <div className="detail-hero-main">
            {coverImage && (
              <img src={coverImage} alt={title} className="detail-poster" loading="lazy" />
            )}
            <div className="detail-hero-info">
              <h1 className="detail-title">{title}</h1>
              {titleEn && titleEn !== title && (
                <p className="detail-title-en">{titleEn}</p>
              )}

              {/* MAL Score */}
              {detail && detail.score > 0 && (
                <div className="detail-score-row">
                  <div className="detail-mal-score">
                    <Star size={18} fill="currentColor" />
                    <span className="score-value">{detail.score.toFixed(1)}</span>
                    <span className="score-max">/ 10</span>
                  </div>
                  <span className="score-users">{detail.scored_by?.toLocaleString('fr-FR')} votes</span>
                  {detail.rank && (
                    <span className="detail-rank">
                      <Trophy size={14} /> #{detail.rank}
                    </span>
                  )}
                </div>
              )}

              {/* Genres */}
              {detail && detail.genres.length > 0 && (
                <div className="detail-genres">
                  {detail.genres.map(g => (
                    <span key={g.mal_id} className="genre-tag">{g.name}</span>
                  ))}
                  {detail.themes.map(t => (
                    <span key={t.mal_id} className="genre-tag theme-tag">{t.name}</span>
                  ))}
                </div>
              )}

              {/* Quick info */}
              <div className="detail-meta-row">
                {detail?.episodes && (
                  <span className="meta-chip"><Tv size={14} /> {detail.episodes} épisodes</span>
                )}
                {detail?.duration && (
                  <span className="meta-chip"><Clock size={14} /> {detail.duration}</span>
                )}
                {detail?.status && (
                  <span className="meta-chip status-chip">{STATUS_FR[detail.status] || detail.status}</span>
                )}
                {detail?.source && (
                  <span className="meta-chip"><BookOpen size={14} /> {detail.source}</span>
                )}
                {detail?.season && detail?.year && (
                  <span className="meta-chip"><Clapperboard size={14} /> {SEASON_FR[detail.season] || detail.season} {detail.year}</span>
                )}
                {detail?.rating && (
                  <span className="meta-chip">{detail.rating}</span>
                )}
              </div>

              {/* Studios */}
              {detail && detail.studios.length > 0 && (
                <div className="detail-studios">
                  <Film size={14} />
                  {detail.studios.map(s => s.name).join(', ')}
                </div>
              )}

              {/* Actions */}
              <div className="detail-actions">
                {anime && anime.animethemes?.length > 0 && (
                  <button className="detail-play-btn" onClick={() => setShowPlayer(true)}>
                    <Play size={18} fill="white" /> Écouter les thèmes ({anime.animethemes.length})
                  </button>
                )}
                {detail?.trailer?.embed_url && (
                  <a
                    href={detail.trailer.url || `https://www.youtube.com/watch?v=${detail.trailer.youtube_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="detail-trailer-btn"
                  >
                    <Play size={16} /> Trailer
                  </a>
                )}
                {hasUserRating && (
                  <span className="detail-rated-badge">
                    <CheckCircle size={16} /> Déjà noté
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="detail-main">
        {/* ===== SYNOPSIS ===== */}
        {synopsis && (
          <section className="detail-section">
            <h2 className="detail-section-title"><BookOpen size={18} /> Synopsis</h2>
            <p className="detail-synopsis">{synopsis}</p>
          </section>
        )}

        {/* ===== ANIME RATING ===== */}
        {anime && (
          <section className="detail-section">
            <h2 className="detail-section-title"><Star size={18} /> Noter cet anime</h2>
            <RatingControl
              mode="anime"
              animeId={anime.id}
              animeName={anime.name}
              coverImage={coverImage}
              franchise={franchise}
            />
          </section>
        )}

        {/* ===== TRAILER ===== */}
        {detail?.trailer?.embed_url && (
          <section className="detail-section">
            <h2 className="detail-section-title"><Play size={18} /> Trailer</h2>
            <div className="detail-trailer-wrapper">
              <iframe
                src={detail.trailer.embed_url.replace('autoplay=1', 'autoplay=0')}
                title="Trailer"
                allowFullScreen
                allow="encrypted-media"
                className="detail-trailer-iframe"
              />
            </div>
          </section>
        )}

        {/* ===== KEY STAFF (Composers, Directors) ===== */}
        {keyStaff.length > 0 && (
          <section className="detail-section">
            <h2 className="detail-section-title"><Music size={18} /> Staff clé</h2>
            <div className="detail-staff-grid">
              {keyStaff.map((s, i) => (
                <div key={i} className="staff-card glass-panel">
                  {s.person.images?.jpg?.image_url && (
                    <img src={s.person.images.jpg.image_url} alt={s.person.name} className="staff-img" loading="lazy" />
                  )}
                  <div className="staff-info">
                    <span className="staff-name">{s.person.name}</span>
                    <span className="staff-role">{s.positions.join(', ')}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ===== CHARACTERS ===== */}
        {displayChars.length > 0 && (
          <section className="detail-section">
            <h2 className="detail-section-title"><Users size={18} /> Personnages</h2>
            <div className="detail-chars-grid">
              {displayChars.map((c) => (
                <div key={c.character.mal_id} className="char-card glass-panel">
                  <img
                    src={c.character.images?.webp?.image_url || c.character.images?.jpg?.image_url}
                    alt={c.character.name}
                    className="char-img"
                    loading="lazy"
                  />
                  <div className="char-info">
                    <span className="char-name">{c.character.name}</span>
                    <span className={`char-role ${c.role === 'Main' ? 'main' : 'support'}`}>{c.role === 'Main' ? 'Principal' : 'Secondaire'}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ===== RELATIONS (Sequels, Prequels, etc.) ===== */}
        {detail && detail.relations.length > 0 && (
          <section className="detail-section">
            <h2 className="detail-section-title"><Palette size={18} /> Relations</h2>
            <div className="detail-relations">
              {detail.relations
                .filter(r => r.entry.some(e => e.type === 'anime'))
                .map((rel, i) => (
                  <div key={i} className="relation-group">
                    <span className="relation-type">{RELATION_FR[rel.relation] || rel.relation}</span>
                    <div className="relation-entries">
                      {rel.entry.filter(e => e.type === 'anime').map(e => (
                        <button
                          key={e.mal_id}
                          className="relation-entry"
                          onClick={() => handleRelationClick(e.name, e.mal_id)}
                        >
                          {e.name} <ChevronRight size={14} />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* ===== RECOMMENDATIONS ===== */}
        {recommendations.length > 0 && (
          <section className="detail-section">
            <h2 className="detail-section-title"><Sparkles size={18} /> Recommandations</h2>
            <div className="detail-recs-grid">
              {recommendations.slice(0, 10).map((rec) => (
                <button
                  key={rec.entry.mal_id}
                  className="rec-card"
                  onClick={() => handleRecommendationClick(rec)}
                >
                  <img
                    src={rec.entry.images?.webp?.large_image_url || rec.entry.images?.jpg?.large_image_url}
                    alt={rec.entry.title}
                    className="rec-img"
                    loading="lazy"
                  />
                  <span className="rec-title">{rec.entry.title}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ===== STREAMING ===== */}
        {detail && detail.streaming.length > 0 && (
          <section className="detail-section">
            <h2 className="detail-section-title"><Tv size={18} /> Où regarder</h2>
            <div className="detail-streaming">
              {detail.streaming.map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="streaming-link glass-panel">
                  {s.name} <ExternalLink size={14} />
                </a>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Theme Player Modal */}
      {showPlayer && anime && (
        <ThemePlayerModal anime={anime} onClose={() => setShowPlayer(false)} />
      )}
    </div>
  );
};
