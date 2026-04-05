import React from 'react';
import { Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Anime } from '../services/api';
import './AnimeCard.css';

interface AnimeCardProps {
  anime: Anime;
  onClick?: (anime: Anime) => void;
}

const SEASON_FR: Record<string, string> = {
  Winter: 'Hiver',
  Spring: 'Printemps',
  Summer: 'Été',
  Fall: 'Automne',
};

export const AnimeCard: React.FC<AnimeCardProps> = ({ anime, onClick }) => {
  const navigate = useNavigate();

  // Prefer Large Cover for sharp images, fallback to Small Cover
  const largeCover = anime.images?.find((img) => img.facet === 'Large Cover')?.link;
  const smallCover = anime.images?.find((img) => img.facet === 'Small Cover')?.link;
  const coverImage = largeCover || smallCover;

  const opCount = anime.animethemes?.filter(t => t.type === 'OP').length || 0;
  const edCount = anime.animethemes?.filter(t => t.type === 'ED').length || 0;
  const totalThemes = anime.animethemes?.length || 0;

  const seasonFr = anime.season ? (SEASON_FR[anime.season] || anime.season) : '';

  const handleClick = () => {
    if (onClick) {
      onClick(anime);
    } else {
      navigate(`/anime/${encodeURIComponent(anime.name)}`);
    }
  };

  return (
    <div className="anime-card" onClick={handleClick}>
      <div className="card-image-wrapper">
        {coverImage ? (
          <img
            src={coverImage}
            alt={anime.name}
            className="card-image"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="card-placeholder">
            <span>{anime.name?.charAt(0) || '?'}</span>
          </div>
        )}
        <div className="card-overlay">
          <div className="play-icon-wrapper">
            <Play size={24} className="play-icon" fill="white" />
          </div>
          <span className="overlay-badge">{totalThemes} Thème{totalThemes !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <div className="card-content">
        <h3 className="card-title" title={anime.name}>{anime.name}</h3>
        <div className="card-meta">
          <span>{anime.year}</span>
          {seasonFr && (
            <>
              <span className="card-meta-dot"></span>
              <span>{seasonFr}</span>
            </>
          )}
        </div>
        {(opCount > 0 || edCount > 0) && (
          <div className="card-type-badges">
            {opCount > 0 && <span className="type-badge op">{opCount} OP</span>}
            {edCount > 0 && <span className="type-badge ed">{edCount} ED</span>}
          </div>
        )}
      </div>
    </div>
  );
};
