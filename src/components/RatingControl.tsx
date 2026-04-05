import { useState, useEffect } from 'react';
import { BookOpen, Users as UsersIcon, Palette, Music, Timer, Save, Check } from 'lucide-react';
import { ref, set, onValue, get } from 'firebase/database';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './Toast';
import './RatingControl.css';

interface AnimeRatingProps {
  mode: 'anime';
  animeId: string | number;
  animeName?: string;
  coverImage?: string;
  franchise?: string;
}

interface ThemeRatingProps {
  mode: 'theme';
  animeId: string | number;
  animeName?: string;
  coverImage?: string;
  franchise?: string;
  themeId: string | number;
  themeType?: string;
  themeSlug?: string;
}

type RatingControlProps = AnimeRatingProps | ThemeRatingProps;

const ANIME_CATEGORIES = [
  { key: 'plot', label: 'Scénario', icon: BookOpen, color: '#8b5cf6' },
  { key: 'characters', label: 'Personnages', icon: UsersIcon, color: '#06d6a0' },
  { key: 'animation', label: 'Animation', icon: Palette, color: '#f72585' },
  { key: 'ost', label: 'OST', icon: Music, color: '#fbbf24' },
  { key: 'pacing', label: 'Rythme', icon: Timer, color: '#06b6d4' },
];

const THEME_CATEGORIES = [
  { key: 'music', label: 'Musique', icon: Music, color: '#f72585' },
  { key: 'animation', label: 'Animation', icon: Palette, color: '#06b6d4' },
];

export const RatingControl: React.FC<RatingControlProps> = (props) => {
  const { mode, animeId, animeName, coverImage, franchise } = props;
  const themeId = mode === 'theme' ? (props as ThemeRatingProps).themeId : null;
  const themeType = mode === 'theme' ? (props as ThemeRatingProps).themeType || '' : '';
  const themeSlug = mode === 'theme' ? (props as ThemeRatingProps).themeSlug || '' : '';

  const categories = mode === 'anime' ? ANIME_CATEGORIES : THEME_CATEGORIES;
  const dbRootKey = mode === 'anime' ? 'ratings' : 'themeRatings';
  const itemId = mode === 'anime' ? animeId : themeId!;
  const userDbKey = mode === 'anime' ? 'ratings' : 'themeRatings';
  const getDefaults = () => Object.fromEntries(categories.map(c => [c.key, 50]));

  const { user } = useAuth();
  const { showToast } = useToast();
  const [scores, setScores] = useState<Record<string, number>>(getDefaults());
  const [hasExisting, setHasExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [averages, setAverages] = useState<Record<string, number> | null>(null);
  const [voteCount, setVoteCount] = useState(0);

  useEffect(() => {
    if (!itemId) return;

    if (user) {
      get(ref(db, `users/${user.uid}/${userDbKey}/${itemId}`)).then((snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const loaded: Record<string, number> = {};
          categories.forEach(c => { loaded[c.key] = data[c.key] || 50; });
          setScores(loaded);
          setHasExisting(true);
        } else {
          setScores(getDefaults());
          setHasExisting(false);
        }
      });
    } else {
      setScores(getDefaults());
      setHasExisting(false);
    }

    const globalRef = ref(db, `${dbRootKey}/${itemId}/users`);
    const unsub = onValue(globalRef, (snapshot) => {
      if (snapshot.exists()) {
        const users = snapshot.val();
        const entries = Object.values(users) as Record<string, number>[];
        const count = entries.length;
        if (count > 0) {
          const totals: Record<string, number> = {};
          categories.forEach(c => { totals[c.key] = 0; });
          entries.forEach(e => {
            categories.forEach(c => { totals[c.key] += e[c.key] || 0; });
          });
          const avgs: Record<string, number> = {};
          categories.forEach(c => { avgs[c.key] = totals[c.key] / count; });
          setAverages(avgs);
          setVoteCount(count);
        }
      } else {
        setAverages(null);
        setVoteCount(0);
      }
    });

    return () => unsub();
  }, [itemId, user]);

  const handleSave = async () => {
    if (!user) {
      showToast("Connecte-toi pour noter !", "info");
      return;
    }
    setSaving(true);
    try {
      const saveData: Record<string, any> = { ...scores, timestamp: Date.now() };
      if (mode === 'anime') {
        saveData.animeName = animeName || '';
        if (coverImage) saveData.coverImage = coverImage;
        if (franchise) saveData.franchise = franchise;
      } else {
        saveData.animeName = animeName || '';
        saveData.animeId = animeId;
        saveData.themeType = themeType;
        saveData.themeSlug = themeSlug;
        if (franchise) saveData.franchise = franchise;
      }
      await set(ref(db, `users/${user.uid}/${userDbKey}/${itemId}`), saveData);
      await set(ref(db, `${dbRootKey}/${itemId}/users/${user.uid}`), { ...scores });
      if (mode === 'anime' && animeName) {
        const meta: Record<string, any> = { animeName, animeId };
        if (coverImage) meta.coverImage = coverImage;
        if (franchise) meta.franchise = franchise;
        await set(ref(db, `${dbRootKey}/${itemId}/meta`), meta);
      } else if (mode === 'theme') {
        await set(ref(db, `${dbRootKey}/${itemId}/meta`), {
          animeName: animeName || '', animeId, themeType, themeSlug
        });
      }
      setHasExisting(true);
      setJustSaved(true);
      showToast("Notes sauvegardées !", "success");
      setTimeout(() => setJustSaved(false), 2000);
    } catch (err) {
      console.error("Error saving rating:", err);
      showToast("Erreur lors de la sauvegarde.", "error");
    } finally {
      setSaving(false);
    }
  };

  const catKeys = categories.map(c => c.key);
  const overall = Math.round(catKeys.reduce((sum, k) => sum + (scores[k] || 0), 0) / catKeys.length);
  const avgOverall = averages
    ? (catKeys.reduce((sum, k) => sum + (averages[k] || 0), 0) / catKeys.length).toFixed(1)
    : null;

  return (
    <div className="rating-control">
      <div className="rating-header">
        <h4>{mode === 'anime' ? 'Noter cet anime' : 'Noter cet OP/ED'}</h4>
        <div className="rating-header-right">
          {voteCount > 0 && (
            <span className="vote-count-badge">{voteCount} vote{voteCount > 1 ? 's' : ''}</span>
          )}
          {justSaved && <span className="saved-badge"><Check size={12} /> Sauvegardé</span>}
          {!user && <span className="login-prompt">(Connexion requise)</span>}
        </div>
      </div>

      <div className="rating-categories">
        {categories.map(({ key, label, icon: Icon, color }) => (
          <div key={key} className="rating-category">
            <div className="category-header">
              <div className="category-label" style={{ color }}>
                <Icon size={14} />
                <span>{label}</span>
              </div>
              <div className="category-scores">
                <span className="category-value" style={{ color }}>{scores[key]}</span>
                <span className="category-max">/100</span>
                {averages && (
                  <span className="category-avg" title="Moyenne globale">
                    Ø {averages[key].toFixed(0)}
                  </span>
                )}
              </div>
            </div>
            <div className="slider-wrapper">
              <div className="slider-track-bg">
                <div
                  className="slider-track-fill"
                  style={{ width: `${scores[key]}%`, background: color }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={scores[key]}
                onChange={(e) => setScores(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                disabled={!user || saving}
                className="rating-slider"
                aria-label={`${label} /100`}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="rating-footer">
        <div className="overall-score">
          <span className="overall-label">Note globale</span>
          <span className="overall-value">{overall}</span>
          <span className="overall-max">/100</span>
          {avgOverall && (
            <span className="overall-avg">Moy. communauté : {avgOverall}</span>
          )}
        </div>
        <button
          className={`save-rating-btn ${justSaved ? 'saved' : ''}`}
          onClick={handleSave}
          disabled={!user || saving}
        >
          {saving ? (
            'Sauvegarde...'
          ) : justSaved ? (
            <><Check size={16} /> Sauvegardé</>
          ) : hasExisting ? (
            <><Save size={16} /> Mettre à jour</>
          ) : (
            <><Save size={16} /> Sauvegarder</>
          )}
        </button>
      </div>
    </div>
  );
};
