import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Sparkles, Search, ArrowLeft } from 'lucide-react';
import { useSection } from '../contexts/SectionContext';
import { MediaCard } from '../components/MediaCard';
import { Loader } from '../components/Loader';
import { searchMovies, searchTVShows } from '../services/tmdb';
import type { TMDBMovie, TMDBTVShow } from '../services/tmdb';
import './MediaSearch.css';

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

export const MediaSearch: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const section = useSection();
  const query = searchParams.get('q') || '';
  const isMovie = section.type === 'films';

  const [results, setResults] = useState<(TMDBMovie | TMDBTVShow)[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(false);
    const doSearch = isMovie ? searchMovies : searchTVShows;
    doSearch(query)
      .then((data) => {
        setResults(data);
        setSearched(true);
      })
      .catch(() => {
        setResults([]);
        setSearched(true);
      })
      .finally(() => setLoading(false));
  }, [query, isMovie]);

  const label = isMovie ? 'film' : 'série';

  return (
    <main className="media-search-main">
      {!query.trim() ? (
        <div className="media-search-empty glass-panel">
          <Search size={32} />
          <p>Tape un nom de {label} pour lancer la recherche.</p>
          <button className="media-search-back-btn" onClick={() => navigate(section.prefix)}>
            <ArrowLeft size={16} /> Retour
          </button>
        </div>
      ) : loading ? (
        <Loader />
      ) : searched && results.length === 0 ? (
        <div className="media-search-empty glass-panel">
          <Sparkles size={32} />
          <p>Aucun {label} trouvé pour « <strong>{query}</strong> ».</p>
          <button className="media-search-back-btn" onClick={() => navigate(section.prefix)}>
            <ArrowLeft size={16} /> Retour
          </button>
        </div>
      ) : (
        <>
          <div className="media-search-header">
            <div className="media-search-icon"><Sparkles size={20} /></div>
            <h2 className="media-search-title">Résultats pour « {query} »</h2>
            <span className="media-search-count">{results.length} trouvé{results.length > 1 ? 's' : ''}</span>
          </div>
          <div className="media-search-grid">
            {results.map((item, index) => (
              <div key={item.id} className="media-search-grid-item" style={{ animationDelay: `${index * 0.04}s` }}>
                <MediaCard media={toCard(item)} />
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
};
