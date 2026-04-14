import { useState, useEffect } from 'react';
import { Search, Play, User as UserIcon, LogOut, Trophy, UserCircle, ListMusic, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSection } from '../contexts/SectionContext';
import { AuthModal } from './AuthModal';
import './Header.css';

interface HeaderProps {
  initialQuery?: string;
}

const SEARCH_PLACEHOLDERS: Record<string, string> = {
  anime: 'Rechercher un anime... (ex: SAO, SNK, Naruto)',
  films: 'Rechercher un film... (ex: Inception, Interstellar)',
  series: 'Rechercher une série... (ex: Breaking Bad, Stranger Things)',
};

export const Header: React.FC<HeaderProps> = ({ initialQuery = '' }) => {
  const [query, setQuery] = useState(initialQuery);
  const [scrolled, setScrolled] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const section = useSection();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      navigate(`${section.prefix}/search?q=${encodeURIComponent(trimmed)}`);
    }
  };

  return (
    <>
      <header className={`fixed-header glass-panel ${scrolled ? 'header-scrolled' : ''}`}>
        <div className="header-content">
          <div className="logo" onClick={() => {
            setQuery('');
            navigate('/');
          }}>
            <div className="logo-icon-wrapper">
              <Play className="logo-icon" size={18} fill="white" />
            </div>
            <h1 className="text-gradient">{section.label}</h1>
          </div>
          
          <form className="search-form" onSubmit={handleSubmit}>
            <div className="search-input-wrapper">
              <input 
                type="text" 
                placeholder={SEARCH_PLACEHOLDERS[section.type] || SEARCH_PLACEHOLDERS.anime}
                value={query}
                onChange={handleChange}
                className="search-input"
                aria-label={`Rechercher dans ${section.label}`}
              />
              <Search className="search-icon" size={18} />
            </div>
          </form>

          <div className="header-right">
            <button className="leaderboard-nav-btn" onClick={() => navigate(`${section.prefix}/leaderboard`)} title="Classement">
              <Trophy size={16} />
              <span className="leaderboard-nav-text">Classement</span>
            </button>
            {section.type === 'anime' && (
              <button className="leaderboard-nav-btn" onClick={() => navigate('/anime/playlist')} title="Playlist">
                <ListMusic size={16} />
                <span className="leaderboard-nav-text">Playlist</span>
              </button>
            )}
            {user && (
              <button className="leaderboard-nav-btn" onClick={() => navigate(`${section.prefix}/tierlist`)} title="Tier List">
                <Layers size={16} />
                <span className="leaderboard-nav-text">Tier List</span>
              </button>
            )}
            {user && (
              <button className="leaderboard-nav-btn" onClick={() => navigate(`${section.prefix}/profile`)} title="Mon profil">
                <UserCircle size={16} />
                <span className="leaderboard-nav-text">Profil</span>
              </button>
            )}
            {user ? (
              <div className="user-menu">
                <span className="user-name">{user.displayName || user.email?.split('@')[0]}</span>
                <button onClick={signOut} className="auth-btn logout-btn" title="Déconnexion" aria-label="Déconnexion">
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <button onClick={() => setIsAuthModalOpen(true)} className="auth-btn login-btn" aria-label="Connexion">
                <UserIcon size={16} />
                <span>Connexion</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />
    </>
  );
};
