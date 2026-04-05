import React from 'react';
import { Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSection } from '../contexts/SectionContext';
import { tmdbImage } from '../services/tmdb';
import './MediaCard.css';

interface MediaCardProps {
  media: {
    id: number;
    title: string;
    posterPath: string | null;
    year: string;
    voteAverage?: number;
  };
}

export const MediaCard: React.FC<MediaCardProps> = ({ media }) => {
  const navigate = useNavigate();
  const section = useSection();
  const poster = tmdbImage(media.posterPath, 'w342');

  return (
    <div className="media-card" onClick={() => navigate(`${section.prefix}/${media.id}`)}>
      <div className="media-card-image-wrapper">
        {poster ? (
          <img src={poster} alt={media.title} className="media-card-image" loading="lazy" />
        ) : (
          <div className="media-card-placeholder">
            <Star size={28} />
          </div>
        )}
        <div className="media-card-overlay">
          <div className="media-play-icon">
            <Star size={24} />
          </div>
        </div>
      </div>
      <div className="media-card-content">
        <p className="media-card-title">{media.title}</p>
        <div className="media-card-meta">
          {media.year && <span>{media.year.slice(0, 4)}</span>}
          {media.voteAverage != null && media.voteAverage > 0 && (
            <>
              <span className="media-card-dot" />
              <span className="media-card-score">
                <Star size={11} /> {media.voteAverage.toFixed(1)}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
