import { useState } from 'react';
import { X, Check, CheckSquare, Plus } from 'lucide-react';
import { ref, set, get } from 'firebase/database';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './Toast';
import { getAnimeName } from '../utils/animeGrouping';
import type { Anime } from '../services/api';
import './SeasonRatingModal.css';

interface SeasonRatingModalProps {
  franchise: string;
  seasons: Anime[];
  onClose: () => void;
}

export const SeasonRatingModal: React.FC<SeasonRatingModalProps> = ({ franchise, seasons, onClose }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const allChecked = checked.size === seasons.length;

  const toggleAll = () => {
    if (allChecked) {
      setChecked(new Set());
    } else {
      setChecked(new Set(seasons.map(s => s.id)));
    }
  };

  const toggleSeason = (id: number) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!user) {
      showToast("Connecte-toi pour ajouter !", "info");
      return;
    }
    if (checked.size === 0) {
      showToast("Sélectionne au moins une saison.", "info");
      return;
    }
    setSaving(true);
    try {
      const promises: Promise<void>[] = [];
      for (const anime of seasons) {
        if (!checked.has(anime.id)) continue;

        // Don't overwrite if already rated
        const existing = await get(ref(db, `users/${user.uid}/ratings/${anime.id}`));
        if (existing.exists()) continue;

        const largeCover = anime.images?.find(img => img.facet === 'Large Cover')?.link;
        const smallCover = anime.images?.find(img => img.facet === 'Small Cover')?.link;
        const cover = largeCover || smallCover || '';
        const franchiseName = getAnimeName(anime.name);

        const saveData: Record<string, unknown> = {
          animeName: anime.name,
          franchise: franchiseName,
          timestamp: Date.now(),
          rated: false,
        };
        if (cover) saveData.coverImage = cover;

        promises.push(set(ref(db, `users/${user.uid}/ratings/${anime.id}`), saveData));
      }
      await Promise.all(promises);
      showToast(`${checked.size} saison${checked.size > 1 ? 's' : ''} ajoutée${checked.size > 1 ? 's' : ''} au profil !`, "success");
      onClose();
    } catch (err) {
      console.error("Error adding to profile:", err);
      showToast("Erreur lors de l'ajout.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="srm-backdrop" onClick={onClose}>
      <div className="srm-modal glass-panel" onClick={e => e.stopPropagation()}>
        <button className="srm-close" onClick={onClose}><X size={20} /></button>
        <h2 className="srm-title">{franchise}</h2>
        <p className="srm-subtitle">Sélectionne les saisons que tu as vues :</p>
        <button className="srm-toggle-all" onClick={toggleAll}>
          <CheckSquare size={16} />
          {allChecked ? 'Tout désélectionner' : 'Tout vu'}
        </button>
        <div className="srm-season-list">
          {seasons.map(anime => {
            const cover = anime.images?.find(i => i.facet === 'Small Cover')?.link
              || anime.images?.find(i => i.facet === 'Large Cover')?.link;
            return (
              <label key={anime.id} className={`srm-season-item${checked.has(anime.id) ? ' checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={checked.has(anime.id)}
                  onChange={() => toggleSeason(anime.id)}
                />
                <div className="srm-season-check">
                  {checked.has(anime.id) && <Check size={14} />}
                </div>
                {cover && <img loading="lazy" src={cover} alt="" className="srm-season-thumb" />}
                <div className="srm-season-info">
                  <span className="srm-season-name">{anime.name}</span>
                  <span className="srm-season-year">{anime.year}</span>
                </div>
              </label>
            );
          })}
        </div>
        <button className="srm-next-btn" onClick={handleSave} disabled={checked.size === 0 || saving}>
          <Plus size={16} />
          {saving ? 'Ajout...' : `Ajouter au profil${checked.size > 0 ? ` (${checked.size})` : ''}`}
        </button>
      </div>
    </div>
  );
};
