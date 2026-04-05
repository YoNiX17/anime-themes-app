import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Sparkles, Search, ArrowLeft } from 'lucide-react';
import { Header } from '../components/Header';
import { AnimeCard } from '../components/AnimeCard';
import { Loader } from '../components/Loader';
import { searchAnime } from '../services/api';
import type { Anime } from '../services/api';
import './SearchResults.css';

export const SearchResults: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';

  const [results, setResults] = useState<Anime[]>([]);
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
    searchAnime(query).then((data) => {
      setResults(data);
      setSearched(true);
      setLoading(false);
    });
  }, [query]);

  return (
    <>
      <Header initialQuery={query} />

      <main className="search-results-main">
        {!query.trim() ? (
          <div className="search-empty glass-panel">
            <Search size={32} />
            <p>Tape un nom d'anime, une abréviation (SNK, JJK, SAO...) ou un titre en anglais/japonais.</p>
            <button className="search-back-btn" onClick={() => navigate('/')}>
              <ArrowLeft size={16} /> Retour à l'accueil
            </button>
          </div>
        ) : loading ? (
          <Loader />
        ) : searched && results.length === 0 ? (
          <div className="search-empty glass-panel">
            <Sparkles size={32} />
            <p>Aucun anime trouvé pour « <strong>{query}</strong> ».</p>
            <p className="search-hint">Essaie un autre terme, une abréviation (ex: SNK, JJK) ou le titre japonais.</p>
            <button className="search-back-btn" onClick={() => navigate('/')}>
              <ArrowLeft size={16} /> Retour à l'accueil
            </button>
          </div>
        ) : (
          <>
            <div className="search-results-header">
              <div className="search-results-icon">
                <Sparkles size={20} />
              </div>
              <h2 className="search-results-title">Résultats pour « {query} »</h2>
              <span className="search-results-count">{results.length} trouvé{results.length > 1 ? 's' : ''}</span>
            </div>
            <div className="search-results-grid">
              {results.map((anime, index) => (
                <div key={anime.id} className="search-grid-item" style={{ animationDelay: `${index * 0.04}s` }}>
                  <AnimeCard anime={anime} />
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
};
