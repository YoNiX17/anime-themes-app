import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Play, User as UserIcon, LogOut, Loader2, Trophy, UserCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AuthModal } from './AuthModal';
import './Header.css';

interface HeaderProps {
  onSearch: (query: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onSearch }) => {
  const [query, setQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Cleanup debounce timer on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const debouncedSearch = useCallback((value: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    
    if (!value.trim()) {
      setIsSearching(false);
      onSearch('');
      return;
    }

    setIsSearching(true);
    debounceTimer.current = setTimeout(() => {
      onSearch(value);
      setIsSearching(false);
    }, 400);
  }, [onSearch]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    debouncedSearch(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setIsSearching(false);
    onSearch(query);
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
            <h1 className="text-gradient">AnimeThemes</h1>
          </div>
          
          <form className="search-form" onSubmit={handleSubmit}>
            <div className="search-input-wrapper">
              <input 
                type="text" 
                placeholder="Rechercher un anime... (ex: SAO, SNK, Naruto)" 
                value={query}
                onChange={handleChange}
                className="search-input"
                aria-label="Rechercher un anime"
              />
              {isSearching ? (
                <Loader2 className="search-icon search-spinner" size={18} />
              ) : (
                <Search className="search-icon" size={18} />
              )}
            </div>
          </form>

          <div className="header-right">
            <button className="leaderboard-nav-btn" onClick={() => navigate('/leaderboard')} title="Classement">
              <Trophy size={16} />
              <span className="leaderboard-nav-text">Classement</span>
            </button>
            {user && (
              <button className="leaderboard-nav-btn" onClick={() => navigate('/profile')} title="Mon profil">
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
