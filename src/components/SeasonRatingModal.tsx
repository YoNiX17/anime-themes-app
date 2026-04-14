import { useState } from 'react';
import { X, Check, BookOpen, Users as UsersIcon, Palette, Music, Timer, Save, CheckSquare } from 'lucide-react';
import { ref, set } from 'firebase/database';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './Toast';
import { refreshAnimeRatingMeta } from '../utils/ratingMeta';
import { getAnimeName } from '../utils/animeGrouping';
import type { Anime } from '../services/api';
import './SeasonRatingModal.css';

interface SeasonRatingModalProps {
  franchise: string;
  seasons: Anime[];
  onClose: () => void;
}

const CATEGORIES = [
  { key: 'plot', label: 'Scénario', icon: BookOpen, color: '#8b5cf6' },
  { key: 'characters', label: 'Personnages', icon: UsersIcon, color: '#06d6a0' },
  { key: 'animation', label: 'Animation', icon: Palette, color: '#f72585' },
  { key: 'ost', label: 'OST', icon: Music, color: '#fbbf24' },
  { key: 'pacing', label: 'Rythme', icon: Timer, color: '#06b6d4' },
];

type ScoresMap = Record<number, Record<string, number>>;

export const SeasonRatingModal: React.FC<SeasonRatingModalProps> = ({ franchise, seasons, onClose }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [scores, setScores] = useState<ScoresMap>({});
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'select' | 'rate'>('select');

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

  const getScores = (animeId: number) => scores[animeId] || Object.fromEntries(CATEGORIES.map(c => [c.key, 50]));

  const setScore = (animeId: number, key: string, value: number) => {
    setScores(prev => ({
      ...prev,
      [animeId]: { ...getScores(animeId), [key]: value },
    }));
  };

  const goToRate = () => {
    if (checked.size === 0) {
      showToast("Sélectionne au moins une saison.", "info");
      return;
    }
    // Init default scores for checked seasons
    const init: ScoresMap = {};
    for (const id of checked) {
      init[id] = scores[id] || Object.fromEntries(CATEGORIES.map(c => [c.key, 50]));
    }
    setScores(init);
    setStep('rate');
  };

  const handleSave = async () => {
    if (!user) {
      showToast("Connecte-toi pour noter !", "info");
      return;
    }
    setSaving(true);
    try {
      const promises: Promise<void>[] = [];
      for (const anime of seasons) {
        if (!checked.has(anime.id)) continue;
        const s = getScores(anime.id);
        const largeCover = anime.images?.find(img => img.facet === 'Large Cover')?.link;
        const smallCover = anime.images?.find(img => img.facet === 'Small Cover')?.link;
        const cover = largeCover || smallCover || '';
        const franchiseName = getAnimeName(anime.name);

        const saveData: Record<string, unknown> = {
          ...s,
          timestamp: Date.now(),
          animeName: anime.name,
          franchise: franchiseName,
        };
        if (cover) saveData.coverImage = cover;

        promises.push(set(ref(db, `users/${user.uid}/ratings/${anime.id}`), saveData));
        promises.push(set(ref(db, `ratings/${anime.id}/users/${user.uid}`), { ...s }));
        promises.push(
          refreshAnimeRatingMeta(anime.id, {
            animeName: anime.name,
            animeId: anime.id,
            ...(cover ? { coverImage: cover } : {}),
            franchise: franchiseName,
          })
        );
      }
      await Promise.all(promises);
      showToast(`${checked.size} saison${checked.size > 1 ? 's' : ''} notée${checked.size > 1 ? 's' : ''} !`, "success");
      onClose();
    } catch (err) {
      console.error("Error saving ratings:", err);
      showToast("Erreur lors de la sauvegarde.", "error");
    } finally {
      setSaving(false);
    }
  };

  const selectedSeasons = seasons.filter(s => checked.has(s.id));

  return (
    <div className="srm-backdrop" onClick={onClose}>
      <div className="srm-modal glass-panel" onClick={e => e.stopPropagation()}>
        <button className="srm-close" onClick={onClose}><X size={20} /></button>
        <h2 className="srm-title">{franchise}</h2>

        {step === 'select' ? (
          <>
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
                    {cover && <img src={cover} alt="" className="srm-season-thumb" />}
                    <div className="srm-season-info">
                      <span className="srm-season-name">{anime.name}</span>
                      <span className="srm-season-year">{anime.year}</span>
                    </div>
                  </label>
                );
              })}
            </div>
            <button className="srm-next-btn" onClick={goToRate} disabled={checked.size === 0}>
              Noter {checked.size > 0 ? `(${checked.size})` : ''}
            </button>
          </>
        ) : (
          <>
            <p className="srm-subtitle">Note chaque saison sélectionnée :</p>
            <button className="srm-back-btn" onClick={() => setStep('select')}>← Retour à la sélection</button>
            <div className="srm-rate-list">
              {selectedSeasons.map(anime => {
                const s = getScores(anime.id);
                const overall = Math.round(CATEGORIES.reduce((sum, c) => sum + (s[c.key] || 0), 0) / CATEGORIES.length);
                return (
                  <div key={anime.id} className="srm-rate-block">
                    <div className="srm-rate-header">
                      <span className="srm-rate-name">{anime.name}</span>
                      <span className="srm-rate-overall" style={{ color: overall >= 70 ? '#06d6a0' : overall >= 40 ? '#fbbf24' : '#f72585' }}>
                        {overall}
                      </span>
                    </div>
                    <div className="srm-sliders">
                      {CATEGORIES.map(cat => {
                        const Icon = cat.icon;
                        return (
                          <div key={cat.key} className="srm-slider-row">
                            <Icon size={14} style={{ color: cat.color, flexShrink: 0 }} />
                            <span className="srm-slider-label">{cat.label}</span>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={s[cat.key] || 50}
                              onChange={e => setScore(anime.id, cat.key, Number(e.target.value))}
                              className="srm-slider"
                              style={{ '--slider-color': cat.color } as React.CSSProperties}
                            />
                            <span className="srm-slider-value">{s[cat.key] || 50}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <button className="srm-save-btn" onClick={handleSave} disabled={saving}>
              <Save size={16} />
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
