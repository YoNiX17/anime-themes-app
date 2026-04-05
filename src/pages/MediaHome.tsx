import { useState, useEffect } from 'react';
import { TrendingUp, Flame } from 'lucide-react';
import { useSection } from '../contexts/SectionContext';
import { MediaCard } from '../components/MediaCard';
import { Loader } from '../components/Loader';
import {
  fetchTrendingMovies, fetchPopularMovies,
  fetchTrendingTVShows, fetchPopularTVShows,
} from '../services/tmdb';
import type { TMDBMovie, TMDBTVShow } from '../services/tmdb';
import './MediaHome.css';

function toCard(item: TMDBMovie | TMDBTVShow) {
  const isMovie = 'title' in item;
  return {
    id: item.id,
    title: isMovie ? (item as TMDBMovie).title : (item as TMDBTVShow).name,
    posterPath: item.poster_path,
    year: isMovie ? (item as TMDBMovie).release_date || '' : (item as TMDBTVShow).first_air_date || '',
    voteAverage: item.vote_average,
  };
}

export const MediaHome: React.FC = () => {
  const section = useSection();
  const isMovie = section.type === 'films';

  const [trending, setTrending] = useState<(TMDBMovie | TMDBTVShow)[]>([]);
  const [popular, setPopular] = useState<(TMDBMovie | TMDBTVShow)[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [loadingPopular, setLoadingPopular] = useState(true);

  useEffect(() => {
    setLoadingTrending(true);
    setLoadingPopular(true);

    const fetchTrending = isMovie ? fetchTrendingMovies : fetchTrendingTVShows;
    const fetchPopular = isMovie ? fetchPopularMovies : fetchPopularTVShows;

    fetchTrending()
      .then(setTrending)
      .catch(console.error)
      .finally(() => setLoadingTrending(false));

    fetchPopular()
      .then(setPopular)
      .catch(console.error)
      .finally(() => setLoadingPopular(false));
  }, [isMovie]);

  const isLoading = loadingTrending && loadingPopular;

  return (
    <>
      {!isLoading && (
        <section className="media-hero-section">
          <h1 className="media-hero-title">
            <span className="text-gradient">{section.label}</span>
          </h1>
          <p className="media-hero-subtitle">
            {isMovie
              ? 'Découvre, note et classe les meilleurs films avec la communauté.'
              : 'Découvre, note et classe les meilleures séries avec la communauté.'}
          </p>
        </section>
      )}

      <main className="media-main-content">
        <section className="media-content-section">
          <div className="media-section-header">
            <div className="media-section-icon"><TrendingUp size={20} /></div>
            <h2 className="media-section-title">Tendances</h2>
            {!loadingTrending && <span className="media-section-count">{trending.length}</span>}
          </div>
          {loadingTrending ? <Loader /> : (
            <div className="media-grid">
              {trending.map((item, i) => (
                <div key={item.id} className="media-grid-item" style={{ animationDelay: `${i * 0.04}s` }}>
                  <MediaCard media={toCard(item)} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="media-content-section">
          <div className="media-section-header">
            <div className="media-section-icon icon-warm"><Flame size={20} /></div>
            <h2 className="media-section-title">Populaires</h2>
            {!loadingPopular && <span className="media-section-count">{popular.length}</span>}
          </div>
          {loadingPopular ? <Loader /> : (
            <div className="media-grid">
              {popular.map((item, i) => (
                <div key={item.id} className="media-grid-item" style={{ animationDelay: `${i * 0.04}s` }}>
                  <MediaCard media={toCard(item)} />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
};
