import { useEffect, useState, useRef, useMemo } from 'react';
import { ref, get } from 'firebase/database';
import { ArrowLeft, Download, Loader2, Play, Film, Tv } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useSection } from '../contexts/SectionContext';
import { getAnimeName } from '../utils/animeGrouping';
import { tmdbImage } from '../services/tmdb';
import './TierList.css';

/* ═══ Types ═══ */
interface TierItem {
  id: string;
  name: string;
  coverImage?: string;
  score: number;
}

interface TierRow {
  tier: string;
  color: string;
  min: number;
  max: number;
  items: TierItem[];
}

const TIERS: Omit<TierRow, 'items'>[] = [
  { tier: 'S', color: '#fbbf24', min: 90, max: 101 },
  { tier: 'A', color: '#06d6a0', min: 75, max: 90 },
  { tier: 'B', color: '#38bdf8', min: 60, max: 75 },
  { tier: 'C', color: '#fb923c', min: 45, max: 60 },
  { tier: 'D', color: '#f87171', min: 30, max: 45 },
  { tier: 'F', color: '#a1a1aa', min: 0, max: 30 },
];

type TierSource = 'anime' | 'films' | 'series';

export const TierList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const section = useSection();
  const tierRef = useRef<HTMLDivElement>(null);

  const [items, setItems] = useState<TierItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [source, setSource] = useState<TierSource>(section.type === 'films' ? 'films' : section.type === 'series' ? 'series' : 'anime');

  useEffect(() => {
    if (!user) { navigate(section.prefix); return; }
    loadRatings(source);
  }, [user, source]);

  const loadRatings = async (src: TierSource) => {
    if (!user) return;
    setLoading(true);
    try {
      if (src === 'anime') {
        const snap = await get(ref(db, `users/${user.uid}/ratings`));
        if (snap.exists()) {
          const data = snap.val();
          // Group by franchise
          const map = new Map<string, { scores: number[]; cover?: string }>();
          Object.entries(data).forEach(([, d]: [string, any]) => {
            const name = getAnimeName(d.animeName || '', d.franchise);
            const avg = ((d.plot || 0) + (d.characters || 0) + (d.animation || 0) + (d.ost || 0) + (d.pacing || 0)) / 5;
            const existing = map.get(name) || { scores: [], cover: undefined };
            existing.scores.push(avg);
            if (d.coverImage) existing.cover = d.coverImage;
            map.set(name, existing);
          });
          setItems(Array.from(map.entries()).map(([name, v]) => ({
            id: name,
            name,
            coverImage: v.cover,
            score: Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length),
          })));
        } else {
          setItems([]);
        }
      } else {
        const node = src === 'films' ? 'movieRatings' : 'seriesRatings';
        const keys = src === 'films'
          ? ['scenario', 'acting', 'directing', 'music']
          : ['scenario', 'acting', 'directing', 'music', 'pacing'];
        const snap = await get(ref(db, `users/${user.uid}/${node}`));
        if (snap.exists()) {
          const data = snap.val();
          setItems(Object.entries(data).map(([id, d]: [string, any]) => {
            const scores = keys.map(k => d[k] || 0);
            return {
              id,
              name: d.mediaTitle || `#${id}`,
              coverImage: d.posterPath ? tmdbImage(d.posterPath, 'w92') : undefined,
              score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
            };
          }));
        } else {
          setItems([]);
        }
      }
    } catch {
      setItems([]);
    }
    setLoading(false);
  };

  const tierRows = useMemo((): TierRow[] => {
    return TIERS.map(t => ({
      ...t,
      items: items
        .filter(i => i.score >= t.min && i.score < t.max)
        .sort((a, b) => b.score - a.score),
    }));
  }, [items]);

  const handleExport = async () => {
    if (!tierRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(tierRef.current, {
        backgroundColor: '#0f0f17',
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `tier-list-${source}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Export failed', err);
    }
    setExporting(false);
  };

  if (!user) return null;

  return (
    <div className="tl-container">
      <div className="tl-main">
        <button className="tl-back-btn" onClick={() => navigate(section.prefix)}>
          <ArrowLeft size={16} /> Accueil
        </button>

        <div className="tl-hero">
          <h1 className="tl-title">Ma Tier List</h1>
          <p className="tl-subtitle">Générée automatiquement à partir de tes notes</p>
        </div>

        {/* Source toggle */}
        <div className="tl-source-toggle">
          <button className={`tl-src-btn ${source === 'anime' ? 'active' : ''}`} onClick={() => setSource('anime')}>
            <Play size={14} /> Anime
          </button>
          <button className={`tl-src-btn ${source === 'films' ? 'active' : ''}`} onClick={() => setSource('films')}>
            <Film size={14} /> Films
          </button>
          <button className={`tl-src-btn ${source === 'series' ? 'active' : ''}`} onClick={() => setSource('series')}>
            <Tv size={14} /> Séries
          </button>
        </div>

        {loading ? (
          <div className="tl-loading"><Loader2 size={28} className="tl-spin" /></div>
        ) : items.length === 0 ? (
          <div className="tl-empty glass-panel">
            <p>Aucune note pour cette catégorie.</p>
          </div>
        ) : (
          <>
            {/* Export button */}
            <div className="tl-actions">
              <button className="tl-export-btn" onClick={handleExport} disabled={exporting}>
                {exporting ? <Loader2 size={14} className="tl-spin" /> : <Download size={14} />}
                {exporting ? 'Export...' : 'Exporter en PNG'}
              </button>
            </div>

            {/* Tier grid */}
            <div className="tl-grid" ref={tierRef}>
              <div className="tl-watermark">anime-themes-app</div>
              {tierRows.map(row => (
                <div key={row.tier} className="tl-row">
                  <div className="tl-tier-label" style={{ background: row.color, color: row.tier === 'F' ? '#333' : '#000' }}>
                    {row.tier}
                  </div>
                  <div className="tl-tier-items">
                    {row.items.length === 0 ? (
                      <span className="tl-tier-empty">—</span>
                    ) : (
                      row.items.map(item => (
                        <div key={item.id} className="tl-item" title={`${item.name} (${item.score})`}>
                          {item.coverImage ? (
                            <img src={item.coverImage} alt={item.name} className="tl-item-img" />
                          ) : (
                            <div className="tl-item-placeholder">
                              <span className="tl-item-initial">{item.name.charAt(0)}</span>
                            </div>
                          )}
                          <span className="tl-item-name">{item.name}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
