import React, { useState, useEffect } from 'react';
import { X, ListMusic, Music } from 'lucide-react';
import type { Anime, AnimeTheme, Video } from '../services/api';
import { RatingControl } from './RatingControl';
import './ThemePlayerModal.css';

interface ThemePlayerModalProps {
  anime: Anime;
  onClose: () => void;
}

export const ThemePlayerModal: React.FC<ThemePlayerModalProps> = ({ anime, onClose }) => {
  const [selectedTheme, setSelectedTheme] = useState<AnimeTheme | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  useEffect(() => {
    if (anime.animethemes && anime.animethemes.length > 0) {
      const defaultTheme = anime.animethemes.find(t => t.type === 'OP') || anime.animethemes[0];
      setSelectedTheme(defaultTheme);
      const entry = defaultTheme.animethemeentries?.[0];
      if (entry && entry.videos?.length > 0) {
        setSelectedVideo(entry.videos[0]);
      }
    }
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [anime]);

  const handleSelectTheme = (theme: AnimeTheme) => {
    setSelectedTheme(theme);
    const entry = theme.animethemeentries?.[0];
    if (entry && entry.videos?.length > 0) {
      setSelectedVideo(entry.videos[0]);
    } else {
      setSelectedVideo(null);
    }
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const seasonMap: Record<string, string> = {
    'Winter': 'Hiver', 'Spring': 'Printemps', 'Summer': 'Été', 'Fall': 'Automne',
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>
          <X size={18} />
        </button>
        
        <div className="modal-header">
          <h2 className="modal-title">{anime.name}</h2>
          <p className="modal-subtitle">
            <span>{anime.year}</span>
            <span>•</span>
            <span>{seasonMap[anime.season] || anime.season}</span>
            <span>•</span>
            <span>{anime.animethemes?.length || 0} thèmes</span>
          </p>
        </div>

        <div className="modal-body">
          <div className="video-section">
            {selectedVideo ? (
              <video 
                key={selectedVideo.link} 
                controls 
                autoPlay 
                className="video-player"
                poster={anime.images?.find((img) => img.facet === 'Large Cover')?.link}
              >
                <source src={selectedVideo.link} type="video/webm" />
                Votre navigateur ne supporte pas la vidéo.
              </video>
            ) : (
              <div className="no-video-placeholder">
                <Music size={32} />
                <p>Pas de vidéo disponible</p>
              </div>
            )}
            
            {selectedTheme && (
              <div className="theme-info-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                <div className="current-theme-title">
                  <span className="theme-title-type">{selectedTheme.type}{selectedTheme.sequence || ''}</span>
                  <span className="theme-title-name">{selectedTheme.slug}</span>
                </div>
              </div>
            )}

            <RatingControl 
              mode="anime"
              animeId={anime.id}
              animeName={anime.name}
              coverImage={anime.images?.find(img => img.facet === 'Large Cover')?.link || anime.images?.find(img => img.facet === 'Small Cover')?.link}
            />

            {selectedTheme && (
              <RatingControl 
                mode="theme"
                animeId={anime.id}
                animeName={anime.name}
                coverImage={anime.images?.find(img => img.facet === 'Large Cover')?.link || anime.images?.find(img => img.facet === 'Small Cover')?.link}
                themeId={selectedTheme.id}
                themeType={`${selectedTheme.type}${selectedTheme.sequence || ''}`}
                themeSlug={selectedTheme.slug}
              />
            )}
          </div>

          <div className="theme-list-section">
            <div className="theme-list-header">
              <ListMusic size={16} />
              <span>Thèmes</span>
            </div>
            <div className="theme-list">
              {anime.animethemes?.map((theme) => (
                <button 
                  key={theme.id}
                  className={`theme-list-item ${selectedTheme?.id === theme.id ? 'active' : ''}`}
                  onClick={() => handleSelectTheme(theme)}
                >
                  <span className="theme-type">{theme.type}{theme.sequence || ''}</span>
                  <span className="theme-slug">{theme.slug}</span>
                </button>
              ))}
              {(!anime.animethemes || anime.animethemes.length === 0) && (
                <p className="no-themes-text">Aucun thème trouvé.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
