import { useState, useEffect } from 'react';
import { X, Heart, Calendar, User as UserIcon, Sparkles, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchAniListCharacterDetail } from '../services/anilist';
import type { AniListCharacter, AniListCharacterDetail } from '../services/anilist';
import './CharacterModal.css';

interface CharacterModalProps {
  character: AniListCharacter;
  onClose: () => void;
}

const GENDER_FR: Record<string, string> = {
  Male: 'Homme',
  Female: 'Femme',
  'Non-binary': 'Non-binaire',
};

function formatDateOfBirth(dob: AniListCharacterDetail['dateOfBirth']): string | null {
  if (!dob) return null;
  const parts: string[] = [];
  if (dob.day) parts.push(String(dob.day));
  if (dob.month) {
    const months = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    parts.push(months[dob.month] || String(dob.month));
  }
  if (dob.year) parts.push(String(dob.year));
  return parts.length ? parts.join(' ') : null;
}

/**
 * Convert AniList markdown-like description to safe JSX.
 * Handles ~!spoiler!~ blocks and __bold__.
 */
function renderDescription(text: string): React.ReactNode[] {
  // Split spoiler blocks
  const parts = text.split(/~!([\s\S]*?)!~/g);
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      // Spoiler block
      elements.push(
        <details key={i} className="char-modal-spoiler">
          <summary>Spoiler (cliquer pour révéler)</summary>
          <p>{parts[i].trim()}</p>
        </details>
      );
    } else if (parts[i].trim()) {
      // Regular text — split by newlines for paragraphs
      const paragraphs = parts[i].split(/\n\n+/);
      for (let j = 0; j < paragraphs.length; j++) {
        if (paragraphs[j].trim()) {
          elements.push(<p key={`${i}-${j}`}>{paragraphs[j].trim()}</p>);
        }
      }
    }
  }
  return elements;
}

export const CharacterModal: React.FC<CharacterModalProps> = ({ character, onClose }) => {
  const [detail, setDetail] = useState<AniListCharacterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAniListCharacterDetail(character.id).then(d => {
      setDetail(d);
      setLoading(false);
    });
  }, [character.id]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleMediaClick = (media: { id: number; title: { romaji: string }; type: string }) => {
    if (media.type === 'ANIME') {
      onClose();
      navigate(`/anime/${encodeURIComponent(media.title.romaji)}`);
    }
  };

  const info = detail || character;
  const dob = detail ? formatDateOfBirth(detail.dateOfBirth) : null;
  const gender = info.gender ? (GENDER_FR[info.gender] || info.gender) : null;

  return (
    <div className="char-modal-overlay" onClick={onClose}>
      <div className="char-modal glass-panel" onClick={e => e.stopPropagation()}>
        <button className="char-modal-close" onClick={onClose}>
          <X size={18} />
        </button>

        <div className="char-modal-body">
          {/* Left: Image + quick stats */}
          <div className="char-modal-left">
            <img
              src={info.image.large}
              alt={info.name.full}
              className="char-modal-img"
            />
            <div className="char-modal-stats">
              {info.favourites > 0 && (
                <div className="char-modal-stat">
                  <Heart size={14} />
                  <span>{info.favourites.toLocaleString('fr-FR')} favoris</span>
                </div>
              )}
              {gender && (
                <div className="char-modal-stat">
                  <UserIcon size={14} />
                  <span>{gender}</span>
                </div>
              )}
              {info.age && (
                <div className="char-modal-stat">
                  <Sparkles size={14} />
                  <span>{info.age} ans</span>
                </div>
              )}
              {dob && (
                <div className="char-modal-stat">
                  <Calendar size={14} />
                  <span>{dob}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Info */}
          <div className="char-modal-right">
            <h2 className="char-modal-name">{info.name.full}</h2>
            {info.name.native && (
              <p className="char-modal-native">{info.name.native}</p>
            )}

            {loading ? (
              <div className="char-modal-loading">
                <div className="char-modal-spinner" />
                <span>Chargement...</span>
              </div>
            ) : (
              <>
                {/* Description */}
                {detail?.description ? (
                  <div className="char-modal-desc">
                    {renderDescription(detail.description)}
                  </div>
                ) : (
                  <p className="char-modal-no-desc">Aucune description disponible.</p>
                )}

                {/* Media appearances */}
                {detail?.media?.nodes && detail.media.nodes.length > 0 && (
                  <div className="char-modal-media-section">
                    <h3 className="char-modal-media-title">
                      <ExternalLink size={14} /> Apparitions
                    </h3>
                    <div className="char-modal-media-grid">
                      {detail.media.nodes.map(m => (
                        <button
                          key={m.id}
                          className={`char-modal-media-item ${m.type === 'ANIME' ? 'clickable' : ''}`}
                          onClick={() => handleMediaClick(m)}
                          disabled={m.type !== 'ANIME'}
                        >
                          {m.coverImage?.large && (
                            <img src={m.coverImage.large} alt={m.title.romaji} className="char-modal-media-cover" loading="lazy" />
                          )}
                          <div className="char-modal-media-info">
                            <span className="char-modal-media-name">{m.title.english || m.title.romaji}</span>
                            <span className="char-modal-media-type">
                              {m.type === 'ANIME' ? 'Anime' : 'Manga'}
                              {m.format ? ` · ${m.format}` : ''}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
