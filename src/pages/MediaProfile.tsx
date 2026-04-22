import { useEffect, useState, useRef } from 'react';
import { ref, onValue, set, remove, get } from 'firebase/database';
import { User as UserIcon, Camera, Trash2, Edit3, Save, ArrowLeft, Loader2, X, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useSection, type RatingCategory } from '../contexts/SectionContext';
import { useToast } from '../components/Toast';
import { refreshMovieRatingMeta, refreshSeriesRatingMeta } from '../utils/ratingMeta';
import { tmdbImage } from '../services/tmdb';
import './MediaProfile.css';

interface UserMediaRating {
  id: string;
  title: string;
  posterPath?: string;
  timestamp: number;
  scores: Record<string, number>;
}

/* ═══ EditModal ═══ */
interface EditModalProps {
  item: UserMediaRating;
  keys: RatingCategory[];
  onSave: (scores: Record<string, number>) => void;
  onClose: () => void;
}

const EditModal: React.FC<EditModalProps> = ({ item, keys, onSave, onClose }) => {
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(keys.map(k => [k.key, item.scores[k.key] || 50]))
  );
  const overall = Math.round(keys.reduce((s, c) => s + (scores[c.key] || 0), 0) / keys.length);

  return (
    <div className="mprof-modal-overlay" onClick={onClose}>
      <div className="mprof-modal glass-panel" onClick={e => e.stopPropagation()}>
        <button className="mprof-modal-close" onClick={onClose}><X size={18} /></button>
        <h3>Modifier — {item.title}</h3>
        <div className="mprof-edit-cats">
          {keys.map(({ key, label, color }) => (
            <div key={key} className="mprof-edit-row">
              <div className="mprof-edit-label" style={{ color }}>{label}</div>
              <div className="mprof-edit-slider">
                <input type="range" min={0} max={100} value={scores[key]}
                  onChange={e => setScores(prev => ({ ...prev, [key]: Number(e.target.value) }))} />
                <span className="mprof-edit-val" style={{ color }}>{scores[key]}</span>
                <span className="mprof-edit-max">/100</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mprof-edit-footer">
          <span className="mprof-edit-overall">Global : {overall}/100</span>
          <button className="mprof-edit-save" onClick={() => onSave(scores)}>
            <Save size={16} /> Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═══ MediaProfile Page ═══ */
export const MediaProfile: React.FC = () => {
  const section = useSection();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [ratings, setRatings] = useState<UserMediaRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState<UserMediaRating | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const keys = section.ratingKeys;
  const refreshMeta = section.type === 'films' ? refreshMovieRatingMeta : refreshSeriesRatingMeta;

  useEffect(() => {
    if (!user) { navigate(section.prefix); return; }

    const unsubAvatar = onValue(ref(db, `users/${user.uid}/profile/avatarUrl`), snap => {
      setAvatarUrl(snap.exists() ? snap.val() : null);
    });

    const unsubRatings = onValue(ref(db, `users/${user.uid}/${section.firebaseUserRatingsNode}`), snap => {
      if (snap.exists()) {
        const data = snap.val();
        const arr: UserMediaRating[] = Object.entries(data).map(([id, d]: [string, any]) => ({
          id,
          title: d.mediaTitle || `#${id}`,
          posterPath: d.posterPath,
          timestamp: d.timestamp || 0,
          scores: Object.fromEntries(keys.map(k => [k.key, d[k.key] || 0])),
        }));
        arr.sort((a, b) => b.timestamp - a.timestamp);
        setRatings(arr);
      } else {
        setRatings([]);
      }
      setLoading(false);
    });

    return () => { unsubAvatar(); unsubRatings(); };
  }, [user, navigate, section, keys]);

  /* ── Avatar upload ── */
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!ALLOWED_TYPES.includes(file.type)) { showToast("Format non supporté.", "error"); return; }
    if (file.size > 200_000) { showToast("Image trop lourde (max 200 Ko).", "error"); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await set(ref(db, `users/${user.uid}/profile/avatarUrl`), reader.result);
        showToast("Avatar mis à jour !", "success");
      } catch { showToast("Erreur upload.", "error"); }
    };
    reader.readAsDataURL(file);
  };

  /* ── Edit ── */
  const handleSave = async (scores: Record<string, number>) => {
    if (!editing || !user) return;
    try {
      const existing = (await get(ref(db, `users/${user.uid}/${section.firebaseUserRatingsNode}/${editing.id}`))).val() || {};
      await set(ref(db, `users/${user.uid}/${section.firebaseUserRatingsNode}/${editing.id}`), {
        ...existing, ...scores, timestamp: Date.now(),
      });
      const globalExisting = (await get(ref(db, `${section.firebaseRatingsNode}/${editing.id}/users/${user.uid}`))).val() || {};
      await set(ref(db, `${section.firebaseRatingsNode}/${editing.id}/users/${user.uid}`), {
        ...globalExisting, ...scores, timestamp: Date.now(),
      });
      await refreshMeta(editing.id);
      showToast("Note modifiée !", "success");
      setEditing(null);
    } catch { showToast("Erreur lors de la sauvegarde.", "error"); }
  };

  /* ── Delete ── */
  const handleDelete = async (item: UserMediaRating) => {
    if (!user || !confirm(`Supprimer la note pour "${item.title}" ?`)) return;
    try {
      await remove(ref(db, `users/${user.uid}/${section.firebaseUserRatingsNode}/${item.id}`));
      await remove(ref(db, `${section.firebaseRatingsNode}/${item.id}/users/${user.uid}`));
      await refreshMeta(item.id);
      showToast("Note supprimée.", "success");
    } catch { showToast("Erreur suppression.", "error"); }
  };

  const overall = (item: UserMediaRating) =>
    Math.round(keys.reduce((s, k) => s + (item.scores[k.key] || 0), 0) / keys.length);

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'mprof-score-legendary';
    if (score >= 75) return 'mprof-score-excellent';
    if (score >= 50) return 'mprof-score-good';
    if (score >= 30) return 'mprof-score-average';
    return 'mprof-score-low';
  };

  if (!user) return null;

  return (
    <div className="mprof-container">
      <main className="mprof-main">
        <button className="mprof-back" onClick={() => navigate(section.prefix)}>
          <ArrowLeft size={18} /> Accueil
        </button>

        {/* Avatar card */}
        <div className="mprof-user glass-panel">
          <div className="mprof-avatar-wrapper" onClick={() => fileInputRef.current?.click()}>
            {avatarUrl ? (
              <img loading="lazy" src={avatarUrl} alt="avatar" className="mprof-avatar" />
            ) : (
              <div className="mprof-avatar-blank"><UserIcon size={36} /></div>
            )}
            <div className="mprof-avatar-overlay"><Camera size={16} /></div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleAvatarUpload} />
          </div>
          <div className="mprof-user-info">
            <h1>{user.displayName || user.email}</h1>
            <p>{ratings.length} {section.label.toLowerCase()} noté{ratings.length > 1 ? 's' : ''}</p>
            <button
              className="mprof-share-btn"
              onClick={() => {
                const url = `${window.location.origin}/profil/${user.uid}`;
                navigator.clipboard.writeText(url);
              }}
            >
              <Share2 size={13} /> Partager
            </button>
          </div>
        </div>

        {/* Ratings */}
        {loading ? (
          <div className="mprof-loading"><Loader2 size={28} className="mprof-spin" /></div>
        ) : ratings.length === 0 ? (
          <div className="mprof-empty glass-panel">
            <p>Aucune note {section.label.toLowerCase()} pour l'instant.</p>
            <button className="mprof-browse-btn" onClick={() => navigate(section.prefix)}>
              Parcourir les {section.label.toLowerCase()}
            </button>
          </div>
        ) : (
          <div className="mprof-list">
            {ratings.map(item => {
              const ov = overall(item);
              return (
                <div key={item.id} className="mprof-card glass-panel">
                  <div className="mprof-card-poster" onClick={() => navigate(`${section.prefix}/${item.id}`)}>
                    {item.posterPath ? (
                      <img loading="lazy" src={tmdbImage(item.posterPath, 'w154')} alt={item.title} />
                    ) : (
                      <div className="mprof-card-placeholder" />
                    )}
                  </div>
                  <div className="mprof-card-info">
                    <h3 className="mprof-card-title" onClick={() => navigate(`${section.prefix}/${item.id}`)}>{item.title}</h3>
                    <div className="mprof-card-scores">
                      {keys.map(k => (
                        <div key={k.key} className="mprof-mini-score" style={{ color: k.color }}>
                          <span className="mprof-mini-label">{k.label}</span>
                          <span className="mprof-mini-val">{item.scores[k.key]}</span>
                        </div>
                      ))}
                    </div>
                    <span className={`mprof-card-overall ${getScoreColor(ov)}`}>{ov}/100</span>
                  </div>
                  <div className="mprof-card-actions">
                    <button className="mprof-action-btn" onClick={() => setEditing(item)} title="Modifier"><Edit3 size={15} /></button>
                    <button className="mprof-action-btn mprof-delete" onClick={() => handleDelete(item)} title="Supprimer"><Trash2 size={15} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {editing && <EditModal item={editing} keys={keys} onSave={handleSave} onClose={() => setEditing(null)} />}
    </div>
  );
};
