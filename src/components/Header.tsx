import { useState, useEffect } from 'react';
import { Search, Play, User as UserIcon, LogOut, Trophy, UserCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AuthModal } from './AuthModal';
import './Header.css';

interface HeaderProps {
  initialQuery?: string;
}

export const Header: React.FC<HeaderProps> = ({ initialQuery = '' }) => {
  const [query, setQuery] = useState(initialQuery);
  const [scrolled, setScrolled] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

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
      navigate(`/search?q=${encodeURIComponent(trimmed)}`);
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
              <Search className="search-icon" size={18} />
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
