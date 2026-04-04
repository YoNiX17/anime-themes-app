import { useState, useEffect } from 'react';
import { Sparkles, TrendingUp, Crown, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { AnimeCard } from '../components/AnimeCard';
import { ThemePlayerModal } from '../components/ThemePlayerModal';
import { Loader } from '../components/Loader';
import { useToast } from '../components/Toast';
import { fetchThisSeason, fetchPopularAnime, searchAnime } from '../services/api';
import { createPartyRoom } from '../services/party';
import { useAuth } from '../contexts/AuthContext';
import type { Anime } from '../services/api';

export const Home: React.FC = () => {
  const [seasonAnimes, setSeasonAnimes] = useState<Anime[]>([]);
  const [popularAnimes, setPopularAnimes] = useState<Anime[]>([]);
  const [searchResults, setSearchResults] = useState<Anime[]>([]);
  const [loadingSeason, setLoadingSeason] = useState(true);
  const [loadingPopular, setLoadingPopular] = useState(true);
  const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearchResult, setIsSearchResult] = useState(false);
  
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    loadBothSections();
  }, []);

  const loadBothSections = async () => {
    setError(null);
    setIsSearchResult(false);

    // Load both sections in parallel
    setLoadingSeason(true);
    setLoadingPopular(true);

    fetchThisSeason()
      .then(data => setSeasonAnimes(data))
      .catch(err => { console.error(err); setError('Failed to load current season.'); })
      .finally(() => setLoadingSeason(false));

    fetchPopularAnime()
      .then(data => setPopularAnimes(data))
      .catch(err => { console.error(err); })
      .finally(() => setLoadingPopular(false));
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setIsSearchResult(false);
      setSearchResults([]);
      return;
    }
    
    try {
      setLoadingSeason(true);
      setError(null);
      setIsSearchResult(true);
      const data = await searchAnime(query);
      setSearchResults(data);
    } catch (err) {
      console.error(err);
      setError('La recherche a échoué. Réessaie plus tard.');
    } finally {
      setLoadingSeason(false);
    }
  };

  const handleCreateParty = async () => {
    if (!user) {
      showToast("Connecte-toi pour créer une party !", "error");
      return;
    }
    try {
      const roomId = await createPartyRoom(user.uid);
      showToast("Party créée ! Redirection...", "success");
      navigate(`/party/${roomId}`);
    } catch (e) {
      console.error("Failed to create room", e);
      showToast("Impossible de créer la party room.", "error");
    }
  };

  const isLoading = loadingSeason && loadingPopular;

  return (
    <>
      <Header onSearch={handleSearch} />
      
      {!isLoading && !error && !isSearchResult && (
        <section className="hero-section">
          <div className="hero-badge">
            <span className="badge-dot"></span>
            Explore les musiques d'anime
          </div>
          <h1 className="hero-title">
            Découvre chaque <span className="highlight text-gradient-cool">Opening</span> &{' '}
            <span className="highlight text-gradient-warm">Ending</span>
          </h1>
          <p className="hero-subtitle">
            Parcours des milliers d'openings et endings d'anime. Recherche par nom, abréviation ou dans n'importe quelle langue. Clique pour regarder et noter.
          </p>
          <div className="hero-actions">
            <button onClick={handleCreateParty} className="hero-party-btn">
              <Users size={18} />
              Créer une Party
            </button>
          </div>
        </section>
      )}

      <main className="main-content">
        {isSearchResult ? (
          // Search results
          <>
            {loadingSeason ? (
              <Loader />
            ) : searchResults.length === 0 ? (
              <div className="empty-state glass-panel">
                <Sparkles size={32} style={{ marginBottom: '1rem', color: 'var(--accent-primary-light)' }} />
                <p>Aucun anime trouvé. Essaie un autre terme de recherche.</p>
              </div>
            ) : (
              <>
                <div className="section-header">
                  <div className="section-header-left">
                    <div className="section-icon">
                      <Sparkles size={20} />
                    </div>
                    <h2 className="section-title">Résultats de recherche</h2>
                    <span className="section-count">{searchResults.length} trouvé{searchResults.length > 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="anime-grid">
                  {searchResults.map((anime, index) => (
                    <div key={anime.id} className="anime-grid-item" style={{ animationDelay: `${index * 0.04}s` }}>
                      <AnimeCard anime={anime} onClick={(a) => setSelectedAnime(a)} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        ) : error ? (
          <div className="error-message glass-panel">
            <p>{error}</p>
            <button onClick={loadBothSections} className="retry-button">Réessayer</button>
          </div>
        ) : (
          // Two sections: This Season + All-Time Popular
          <>
            {/* ===== THIS SEASON ===== */}
            <section className="content-section">
              <div className="section-header">
                <div className="section-header-left">
                  <div className="section-icon">
                    <TrendingUp size={20} />
                  </div>
                  <h2 className="section-title">Cette Saison</h2>
                  {!loadingSeason && <span className="section-count">{seasonAnimes.length} anime</span>}
                </div>
              </div>
              
              {loadingSeason ? (
                <Loader />
              ) : seasonAnimes.length === 0 ? (
                <div className="empty-state glass-panel" style={{ margin: '1rem 0' }}>
                  <p>Aucun anime de la saison en cours trouvé.</p>
                </div>
              ) : (
                <div className="anime-grid">
                  {seasonAnimes.map((anime, index) => (
                    <div key={anime.id} className="anime-grid-item" style={{ animationDelay: `${index * 0.04}s` }}>
                      <AnimeCard anime={anime} onClick={(a) => setSelectedAnime(a)} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ===== ALL-TIME POPULAR ===== */}
            <section className="content-section">
              <div className="section-header">
                <div className="section-header-left">
                  <div className="section-icon icon-warm">
                    <Crown size={20} />
                  </div>
                  <h2 className="section-title">Les Populaires</h2>
                  {!loadingPopular && <span className="section-count">{popularAnimes.length} anime</span>}
                </div>
              </div>
              
              {loadingPopular ? (
                <Loader />
              ) : popularAnimes.length === 0 ? (
                <div className="empty-state glass-panel" style={{ margin: '1rem 0' }}>
                  <p>Les anime populaires arrivent bientôt...</p>
                </div>
              ) : (
                <div className="anime-grid">
                  {popularAnimes.map((anime, index) => (
                    <div key={anime.id} className="anime-grid-item" style={{ animationDelay: `${index * 0.04}s` }}>
                      <AnimeCard anime={anime} onClick={(a) => setSelectedAnime(a)} />
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {selectedAnime && (
        <ThemePlayerModal 
          anime={selectedAnime} 
          onClose={() => setSelectedAnime(null)} 
        />
      )}
    </>
  );
};
