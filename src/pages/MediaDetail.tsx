import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, Clock, Calendar, Play, Sparkles, Users as UsersIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSection } from '../contexts/SectionContext';
import { RatingControl } from '../components/RatingControl';
import { MediaCard } from '../components/MediaCard';
import { Loader } from '../components/Loader';
import {
  fetchMovieDetail, fetchMovieCredits, fetchMovieVideos, fetchMovieRecommendations,
  fetchTVDetail, fetchTVCredits, fetchTVVideos, fetchTVRecommendations,
  tmdbImage,
} from '../services/tmdb';
import { translateToFrench } from '../services/api';
import type { TMDBMovie, TMDBTVShow, TMDBCastMember, TMDBCrewMember, TMDBVideo } from '../services/tmdb';
import { useSiteScore } from '../hooks/useSiteScore';
import './MediaDetail.css';

export const MediaDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const section = useSection();
  const isMovie = section.type === 'films';
  const numericId = Number(id);

  const [movie, setMovie] = useState<TMDBMovie | null>(null);
  const [tv, setTv] = useState<TMDBTVShow | null>(null);
  const [cast, setCast] = useState<TMDBCastMember[]>([]);
  const [crew, setCrew] = useState<TMDBCrewMember[]>([]);
  const [videos, setVideos] = useState<TMDBVideo[]>([]);
  const [recommendations, setRecommendations] = useState<(TMDBMovie | TMDBTVShow)[]>([]);
  const [loading, setLoading] = useState(true);
  const [frSynopsis, setFrSynopsis] = useState<string | null>(null);

  const fbNode = isMovie ? 'movieRatings' : 'seriesRatings';
  const siteScore = useSiteScore(fbNode, numericId || null);

  useEffect(() => {
    if (!numericId) return;
    setLoading(true);
    loadData();
  }, [numericId, isMovie]);

  const loadData = async () => {
    try {
      if (isMovie) {
        const [detail, credits, vids, recs] = await Promise.all([
          fetchMovieDetail(numericId),
          fetchMovieCredits(numericId),
          fetchMovieVideos(numericId),
          fetchMovieRecommendations(numericId),
        ]);
        setMovie(detail);
        setCast(credits.cast.slice(0, 12));
        setCrew(credits.crew);
        setVideos(vids);
        setRecommendations(recs);
        if (detail.overview) {
          translateToFrench(detail.overview).then(setFrSynopsis).catch(() => {});
        }
      } else {
        const [detail, credits, vids, recs] = await Promise.all([
          fetchTVDetail(numericId),
          fetchTVCredits(numericId),
          fetchTVVideos(numericId),
          fetchTVRecommendations(numericId),
        ]);
        setTv(detail);
        setCast(credits.cast.slice(0, 12));
        setCrew(credits.crew);
        setVideos(vids);
        setRecommendations(recs);
        if (detail.overview) {
          translateToFrench(detail.overview).then(setFrSynopsis).catch(() => {});
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Site score handled by useSiteScore hook (see above)

  if (loading) {
    return <div className="mdetail-container"><Loader /></div>;
  }

  const detail = isMovie ? movie : tv;
  if (!detail) {
    return (
      <div className="mdetail-container">
        <div className="mdetail-empty glass-panel">
          <Sparkles size={32} />
          <p>{isMovie ? 'Film' : 'Série'} introuvable.</p>
          <button className="mdetail-back-btn" onClick={() => navigate(section.prefix)}>
            <ArrowLeft size={16} /> Retour
          </button>
        </div>
      </div>
    );
  }

  const title = isMovie ? (movie!.title) : (tv!.name);
  const originalTitle = isMovie ? movie!.original_title : tv!.original_name;
  const backdrop = detail.backdrop_path ? tmdbImage(detail.backdrop_path, 'w1280') : '';
  const poster = detail.poster_path ? tmdbImage(detail.poster_path, 'w500') : '';
  const genres = detail.genres || [];
  const year = isMovie ? movie!.release_date?.slice(0, 4) : tv!.first_air_date?.slice(0, 4);
  const tagline = detail.tagline;
  const synopsis = frSynopsis || detail.overview || '';
  const voteAvg = detail.vote_average;

  // Movie-specific
  const runtime = isMovie ? movie!.runtime : undefined;
  const companies = isMovie ? movie!.production_companies : undefined;

  // TV-specific
  const seasons = !isMovie ? tv!.seasons?.filter(s => s.season_number > 0) : undefined;
  const networks = !isMovie ? tv!.networks : undefined;
  const nbSeasons = !isMovie ? tv!.number_of_seasons : undefined;
  const nbEpisodes = !isMovie ? tv!.number_of_episodes : undefined;

  const trailer = videos.find(v => v.type === 'Trailer') || videos.find(v => v.type === 'Teaser') || videos[0];

  const directors = crew.filter(c => c.job === 'Director').slice(0, 3);
  const creators = !isMovie ? tv!.created_by || [] : [];

  function toRecCard(item: TMDBMovie | TMDBTVShow) {
    const isM = 'title' in item;
    return {
      id: item.id,
      title: isM ? (item as TMDBMovie).title : (item as TMDBTVShow).name,
      posterPath: item.poster_path,
      year: isM ? (item as TMDBMovie).release_date || '' : (item as TMDBTVShow).first_air_date || '',
      voteAverage: item.vote_average,
    };
  }

  return (
    <div className="mdetail-container">
      {/* Hero */}
      <section className="mdetail-hero">
        <div className="mdetail-hero-bg" style={{ backgroundImage: backdrop ? `url(${backdrop})` : undefined }} />
        <div className="mdetail-hero-content">
          <button className="mdetail-back-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Retour
          </button>

          <div className="mdetail-hero-main">
            {poster && <img src={poster} alt={title} className="mdetail-poster" loading="lazy" />}
            <div className="mdetail-hero-info">
              <h1 className="mdetail-title">{title}</h1>
              {originalTitle && originalTitle !== title && (
                <p className="mdetail-original">{originalTitle}</p>
              )}
              {tagline && <p className="mdetail-tagline">« {tagline} »</p>}

              <div className="mdetail-badges">
                {year && <span className="mdetail-badge"><Calendar size={13} /> {year}</span>}
                {runtime && <span className="mdetail-badge"><Clock size={13} /> {runtime} min</span>}
                {nbSeasons != null && <span className="mdetail-badge">{nbSeasons} saison{nbSeasons > 1 ? 's' : ''}</span>}
                {nbEpisodes != null && <span className="mdetail-badge">{nbEpisodes} épisodes</span>}
                {voteAvg > 0 && (
                  <span className="mdetail-badge mdetail-badge-score">
                    <Star size={13} /> TMDB {voteAvg.toFixed(1)}
                  </span>
                )}
                {siteScore && (
                  <span className="mdetail-badge mdetail-badge-site">
                    <UsersIcon size={13} /> Site {siteScore.avg.toFixed(1)} ({siteScore.count})
                  </span>
                )}
              </div>

              <div className="mdetail-genres">
                {genres.map(g => <span key={g.id} className="mdetail-genre">{g.name}</span>)}
              </div>

              {(directors.length > 0 || creators.length > 0) && (
                <div className="mdetail-crew-line">
                  {directors.length > 0 && <span>Réalisé par <strong>{directors.map(d => d.name).join(', ')}</strong></span>}
                  {creators.length > 0 && <span>Créé par <strong>{creators.map(c => c.name).join(', ')}</strong></span>}
                </div>
              )}

              {companies && companies.length > 0 && (
                <div className="mdetail-companies">{companies.map(c => c.name).join(' · ')}</div>
              )}
              {networks && networks.length > 0 && (
                <div className="mdetail-companies">{networks.map(n => n.name).join(' · ')}</div>
              )}
            </div>
          </div>
        </div>
      </section>

      <main className="mdetail-main">
        {/* Synopsis */}
        {synopsis && (
          <section className="mdetail-section glass-panel">
            <h3>Synopsis</h3>
            <p className="mdetail-synopsis">{synopsis}</p>
          </section>
        )}

        {/* Rating */}
        {user && (
          <section className="mdetail-section">
            <RatingControl
              mode={isMovie ? 'movie' : 'series'}
              mediaId={numericId}
              mediaTitle={title}
              posterPath={detail.poster_path || undefined}
            />
          </section>
        )}

        {/* Trailer */}
        {trailer && (
          <section className="mdetail-section">
            <h3><Play size={18} /> Bande-annonce</h3>
            <div className="mdetail-trailer">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${trailer.key}`}
                title={trailer.name}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </section>
        )}

        {/* Cast */}
        {cast.length > 0 && (
          <section className="mdetail-section">
            <h3>Casting</h3>
            <div className="mdetail-cast-grid">
              {cast.map(c => (
                <div key={c.id} className="mdetail-cast-card glass-panel">
                  {c.profile_path ? (
                    <img src={tmdbImage(c.profile_path, 'w185')} alt={c.name} className="mdetail-cast-img" loading="lazy" />
                  ) : (
                    <div className="mdetail-cast-placeholder" />
                  )}
                  <div className="mdetail-cast-info">
                    <p className="mdetail-cast-name">{c.name}</p>
                    <p className="mdetail-cast-role">{c.character}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Seasons (TV only) */}
        {seasons && seasons.length > 0 && (
          <section className="mdetail-section">
            <h3>Saisons</h3>
            <div className="mdetail-seasons-grid">
              {seasons.map(s => (
                <div key={s.id} className="mdetail-season-card glass-panel">
                  {s.poster_path ? (
                    <img src={tmdbImage(s.poster_path, 'w185')} alt={s.name} className="mdetail-season-img" loading="lazy" />
                  ) : (
                    <div className="mdetail-season-placeholder" />
                  )}
                  <div className="mdetail-season-info">
                    <p className="mdetail-season-name">{s.name}</p>
                    <p className="mdetail-season-meta">{s.episode_count} épisodes{s.air_date ? ` · ${s.air_date.slice(0, 4)}` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <section className="mdetail-section">
            <h3>Recommandations</h3>
            <div className="mdetail-rec-grid">
              {recommendations.map(r => (
                <MediaCard key={r.id} media={toRecCard(r)} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
