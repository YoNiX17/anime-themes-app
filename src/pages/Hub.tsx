import { useNavigate } from 'react-router-dom';
import { Play, Film, Tv, Sparkles } from 'lucide-react';
import './Hub.css';

const SECTIONS = [
  {
    key: 'anime',
    label: 'Anime',
    description: 'Openings, Endings, Saisons, Party entre amis',
    icon: Play,
    path: '/anime',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #06d6a0 100%)',
    glow: 'rgba(124, 58, 237, 0.35)',
  },
  {
    key: 'films',
    label: 'Films',
    description: 'Les meilleurs films notés par la communauté',
    icon: Film,
    path: '/films',
    gradient: 'linear-gradient(135deg, #e63946 0%, #f4a261 100%)',
    glow: 'rgba(230, 57, 70, 0.35)',
  },
  {
    key: 'series',
    label: 'Séries',
    description: 'Tes séries préférées, classées et notées',
    icon: Tv,
    path: '/series',
    gradient: 'linear-gradient(135deg, #3a86ff 0%, #06b6d4 100%)',
    glow: 'rgba(58, 134, 255, 0.35)',
  },
];

export const Hub: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="hub-container">
      <div className="hub-hero">
        <div className="hub-badge">
          <Sparkles size={14} />
          Bienvenue
        </div>
        <h1 className="hub-title">
          Choisis ton <span className="hub-highlight">univers</span>
        </h1>
        <p className="hub-subtitle">
          Note, classe et découvre les meilleurs anime, films et séries avec la communauté.
        </p>
      </div>

      <div className="hub-grid">
        {SECTIONS.map((s, i) => {
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              className="hub-card glass-panel"
              onClick={() => navigate(s.path)}
              style={{ animationDelay: `${i * 0.12}s`, '--card-glow': s.glow, '--card-gradient': s.gradient } as React.CSSProperties}
            >
              <div className="hub-card-icon" style={{ background: s.gradient }}>
                <Icon size={32} />
              </div>
              <h2 className="hub-card-title">{s.label}</h2>
              <p className="hub-card-desc">{s.description}</p>
              <div className="hub-card-arrow">→</div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
