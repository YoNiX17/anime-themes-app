import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Sparkles, Search, ArrowLeft, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { AnimeCard } from '../components/AnimeCard';
import { Loader } from '../components/Loader';
import { searchAnime } from '../services/api';
import type { Anime } from '../services/api';
import { groupByFranchise } from '../utils/animeGrouping';
import { SeasonRatingModal } from '../components/SeasonRatingModal';
import './SearchResults.css';

export const SearchResults: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';

  const [results, setResults] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [expandedFranchise, setExpandedFranchise] = useState<string | null>(null);
  const [ratingTarget, setRatingTarget] = useState<{ franchise: string; seasons: Anime[] } | null>(null);

  const groups = useMemo(() => groupByFranchise(results), [results]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(false);
    setExpandedFranchise(null);
    searchAnime(query)
      .then((data) => {
        setResults(data);
        setSearched(true);
      })
      .catch(() => {
        setResults([]);
        setSearched(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [query]);

  const toggleExpand = (franchise: string) => {
    setExpandedFranchise(prev => prev === franchise ? null : franchise);
  };

  return (
    <>
      <main className="search-results-main">
        {!query.trim() ? (
          <div className="search-empty glass-panel">
            <Search size={32} />
            <p>Tape un nom d'anime, une abréviation (SNK, JJK, SAO...) ou un titre en anglais/japonais.</p>
            <button className="search-back-btn" onClick={() => navigate('/anime')}>
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
            <button className="search-back-btn" onClick={() => navigate('/anime')}>
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
              <span className="search-results-count">
                {groups.length} franchise{groups.length > 1 ? 's' : ''} · {results.length} saison{results.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="search-franchise-list">
              {groups.map((group, gi) => {
                const isExpanded = expandedFranchise === group.franchise;
                const firstSeason = group.seasons[0];
                return (
                  <div key={group.franchise} className="franchise-block" style={{ animationDelay: `${gi * 0.05}s` }}>
                    <div className="franchise-header" onClick={() => toggleExpand(group.franchise)}>
                      <div className="franchise-cover-wrapper">
                        {group.cover ? (
                          <img src={group.cover} alt={group.franchise} className="franchise-cover" loading="lazy" />
                        ) : (
                          <div className="franchise-cover-placeholder">{group.franchise.charAt(0)}</div>
                        )}
                      </div>
                      <div className="franchise-info">
                        <h3 className="franchise-name">{group.franchise}</h3>
                        <div className="franchise-meta">
                          <span className="franchise-season-badge">
                            {group.seasons.length} saison{group.seasons.length > 1 ? 's' : ''}
                          </span>
                          <span className="franchise-years">
                            {firstSeason.year}{group.seasons.length > 1 ? ` – ${group.seasons[group.seasons.length - 1].year}` : ''}
                          </span>
                        </div>
                      </div>
                      <div className="franchise-actions">
                        <button
                          className="franchise-rate-btn"
                          title="Ajouter au profil"
                          onClick={(e) => { e.stopPropagation(); setRatingTarget({ franchise: group.franchise, seasons: group.seasons }); }}
                        >
                          <Plus size={16} />
                          <span>Ajouter</span>
                        </button>
                        <div className="franchise-expand-icon">
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="franchise-seasons-grid">
                        {group.seasons.map((anime, index) => (
                          <div key={anime.id} className="search-grid-item" style={{ animationDelay: `${index * 0.04}s` }}>
                            <AnimeCard anime={anime} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
      {ratingTarget && (
        <SeasonRatingModal
          franchise={ratingTarget.franchise}
          seasons={ratingTarget.seasons}
          onClose={() => setRatingTarget(null)}
        />
      )}
    </>
  );
};
