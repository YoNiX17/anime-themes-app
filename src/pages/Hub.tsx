import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Play, Film, Tv, Sparkles, ArrowRight, Star, TrendingUp, Users } from 'lucide-react';
import './Hub.css';

const SECTIONS = [
  {
    key: 'anime',
    label: 'Anime',
    tagline: 'OP · ED · Saisons · Party',
    description: 'Explore les openings, endings, note tes animes favoris et organise des soirées de notation entre amis.',
    icon: Play,
    path: '/anime',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #06d6a0 100%)',
    glow: 'rgba(124, 58, 237, 0.4)',
    color1: '#7c3aed',
    color2: '#06d6a0',
    stats: [
      { icon: Star, label: 'Note sur 100', value: '5 critères' },
      { icon: Users, label: 'Party mode', value: 'Entre amis' },
    ],
  },
  {
    key: 'films',
    label: 'Films',
    tagline: 'Scénario · Acteurs · Réalisation · Musique',
    description: 'Découvre, note et classe les meilleurs films avec un système de notation détaillé par catégorie.',
    icon: Film,
    path: '/films',
    gradient: 'linear-gradient(135deg, #e63946 0%, #f4a261 100%)',
    glow: 'rgba(230, 57, 70, 0.4)',
    color1: '#e63946',
    color2: '#f4a261',
    stats: [
      { icon: Star, label: 'Note sur 100', value: '4 critères' },
      { icon: TrendingUp, label: 'Tendances', value: 'TMDB' },
    ],
  },
  {
    key: 'series',
    label: 'Séries',
    tagline: 'Scénario · Acteurs · Réalisation · Musique · Rythme',
    description: 'Tes séries préférées classées et notées en détail. Partage tes avis avec la communauté.',
    icon: Tv,
    path: '/series',
    gradient: 'linear-gradient(135deg, #3a86ff 0%, #06b6d4 100%)',
    glow: 'rgba(58, 134, 255, 0.4)',
    color1: '#3a86ff',
    color2: '#06b6d4',
    stats: [
      { icon: Star, label: 'Note sur 100', value: '5 critères' },
      { icon: TrendingUp, label: 'Tendances', value: 'TMDB' },
    ],
  },
];

export const Hub: React.FC = () => {
  const navigate = useNavigate();
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  return (
    <div className="hub-container">
      {/* Animated background orbs */}
      <div className="hub-bg" aria-hidden="true">
        <div className="hub-orb hub-orb-1" />
        <div className="hub-orb hub-orb-2" />
        <div className="hub-orb hub-orb-3" />
        <div className="hub-grid-lines" />
      </div>

      {/* Hero */}
      <header className="hub-hero">
        <div className="hub-badge">
          <Sparkles size={13} />
          <span>Plateforme de notation</span>
        </div>
        <h1 className="hub-title">
          <span className="hub-title-line">Choisis ton</span>
          <span className="hub-title-line hub-title-accent">univers</span>
        </h1>
        <p className="hub-subtitle">
          Note, classe et découvre les meilleurs contenus avec la communauté.
          <br />
          Chaque univers possède son propre classement et son propre profil.
        </p>
      </header>

      {/* Cards */}
      <div className="hub-grid">
        {SECTIONS.map((s, i) => {
          const Icon = s.icon;
          const isHovered = hoveredCard === s.key;
          return (
            <button
              key={s.key}
              className={`hub-card ${isHovered ? 'hub-card--active' : ''}`}
              onClick={() => navigate(s.path)}
              onMouseEnter={() => setHoveredCard(s.key)}
              onMouseLeave={() => setHoveredCard(null)}
              style={{
                animationDelay: `${i * 0.15}s`,
                '--card-glow': s.glow,
                '--card-gradient': s.gradient,
                '--card-c1': s.color1,
                '--card-c2': s.color2,
              } as React.CSSProperties}
            >
              {/* Shine sweep */}
              <div className="hub-card-shine" />

              {/* Top border gradient */}
              <div className="hub-card-border-top" />

              <div className="hub-card-content">
                <div className="hub-card-header">
                  <div className="hub-card-icon">
                    <Icon size={28} strokeWidth={2.2} />
                  </div>
                  <div>
                    <h2 className="hub-card-title">{s.label}</h2>
                    <span className="hub-card-tagline">{s.tagline}</span>
                  </div>
                </div>

                <p className="hub-card-desc">{s.description}</p>

                <div className="hub-card-stats">
                  {s.stats.map((stat, j) => {
                    const StatIcon = stat.icon;
                    return (
                      <div key={j} className="hub-card-stat">
                        <StatIcon size={14} />
                        <div>
                          <span className="hub-stat-value">{stat.value}</span>
                          <span className="hub-stat-label">{stat.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="hub-card-cta">
                  <span>Explorer</span>
                  <ArrowRight size={16} />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Bottom tagline */}
      <p className="hub-footer-text">
        Chaque univers. Chaque note. <span className="hub-highlight-inline">Ton classement.</span>
      </p>
    </div>
  );
};
