import { Heart, ExternalLink } from 'lucide-react';
import './Footer.css';

export const Footer = () => {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-left">
          <span className="footer-brand text-gradient">AnimeThemes</span>
          <span className="footer-separator">·</span>
          <span className="footer-credit">
            Fait avec <Heart size={12} className="footer-heart" /> pour les fans d'anime
          </span>
        </div>
        <div className="footer-right">
          <a href="https://animethemes.moe" target="_blank" rel="noopener noreferrer" className="footer-link">
            AnimeThemes API <ExternalLink size={12} />
          </a>
          <span className="footer-separator">·</span>
          <a href="https://jikan.moe" target="_blank" rel="noopener noreferrer" className="footer-link">
            Jikan API <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </footer>
  );
};
