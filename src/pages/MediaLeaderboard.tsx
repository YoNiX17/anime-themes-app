import { useEffect, useState, useMemo } from 'react';
import { ref, onValue } from 'firebase/database';
import { Trophy, ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebase';
import { useSection } from '../contexts/SectionContext';
import { tmdbImage } from '../services/tmdb';
import './MediaLeaderboard.css';

interface RatedMedia {
  id: string;
  title: string;
  posterPath?: string;
  avgOverall: number;
  count: number;
  averages: Record<string, number>;
}

export const MediaLeaderboard: React.FC = () => {
  const section = useSection();
  const navigate = useNavigate();
  const [items, setItems] = useState<RatedMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState('avgOverall');
  const keys = section.ratingKeys;

  useEffect(() => {
    const unsub = onValue(ref(db, section.firebaseRatingsNode), (snap) => {
      if (!snap.exists()) { setItems([]); setLoading(false); return; }
      const data = snap.val();
      const arr: RatedMedia[] = [];
      for (const [id, val] of Object.entries(data) as [string, any][]) {
        const meta = val.meta;
        if (!meta || !meta.avgOverall) continue;
        arr.push({
          id,
          title: meta.mediaTitle || `#${id}`,
          posterPath: meta.posterPath,
          avgOverall: meta.avgOverall,
          count: meta.count || 0,
          averages: Object.fromEntries(keys.map(k => [k.key, meta[k.key] || meta.averages?.[k.key] || 0])),
        });
      }
      setItems(arr);
      setLoading(false);
    });
    return () => unsub();
  }, [section.firebaseRatingsNode, keys]);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      if (sortKey === 'avgOverall') return b.avgOverall - a.avgOverall;
      return (b.averages[sortKey] || 0) - (a.averages[sortKey] || 0);
    });
  }, [items, sortKey]);

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'mlb-score-legendary';
    if (score >= 75) return 'mlb-score-excellent';
    if (score >= 50) return 'mlb-score-good';
    if (score >= 30) return 'mlb-score-average';
    return 'mlb-score-low';
  };

  const podium = sorted.length >= 3 ? sorted.slice(0, 3) : null;
  const list = podium ? sorted.slice(3) : sorted;

  return (
    <div className="mlb-container">
      <main className="mlb-main">
        <div className="mlb-hero">
          <button className="mlb-back-btn" onClick={() => navigate(section.prefix)}>
            <ArrowLeft size={18} /> Accueil
          </button>
          <div className="mlb-hero-icon"><Trophy size={40} /></div>
          <h1 className="mlb-hero-title">
            <span className="text-gradient">Classement {section.label}</span>
          </h1>
          <p className="mlb-hero-subtitle">Les mieux notés par la communauté</p>
        </div>

        {loading ? (
          <div className="mlb-loading"><Loader2 size={28} className="mlb-spin" /></div>
        ) : items.length === 0 ? (
          <div className="mlb-empty glass-panel">
            <Trophy size={32} />
            <p>Aucune note pour l'instant. Sois le premier à noter !</p>
          </div>
        ) : (
          <>
            {/* Sort tabs */}
            <div className="mlb-tabs">
              <button className={`mlb-tab ${sortKey === 'avgOverall' ? 'active' : ''}`} onClick={() => setSortKey('avgOverall')}>
                Global
              </button>
              {keys.map(k => (
                <button key={k.key} className={`mlb-tab ${sortKey === k.key ? 'active' : ''}`} onClick={() => setSortKey(k.key)} style={sortKey === k.key ? { borderColor: k.color, color: k.color } : undefined}>
                  {k.label}
                </button>
              ))}
            </div>

            {/* Podium */}
            {podium && (
              <div className="mlb-podium">
                {[podium[1], podium[0], podium[2]].map((item, idx) => {
                  const rank = idx === 0 ? 2 : idx === 1 ? 1 : 3;
                  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
                  const score = sortKey === 'avgOverall' ? item.avgOverall : (item.averages[sortKey] || 0);
                  return (
                    <div key={item.id} className={`mlb-podium-card glass-panel mlb-podium-${rank}`} onClick={() => navigate(`${section.prefix}/${item.id}`)}>
                      <span className="mlb-medal">{medal}</span>
                      {item.posterPath ? (
                        <img loading="lazy" src={tmdbImage(item.posterPath, 'w185')} alt={item.title} className="mlb-podium-img" />
                      ) : (
                        <div className="mlb-podium-placeholder" />
                      )}
                      <p className="mlb-podium-title">{item.title}</p>
                      <span className={`mlb-podium-score ${getScoreColor(score)}`}>{score.toFixed(1)}</span>
                      <span className="mlb-podium-count">{item.count} vote{item.count > 1 ? 's' : ''}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Table */}
            {list.length > 0 && (
              <div className="mlb-table">
                {list.map((item, idx) => {
                  const rank = (podium ? 4 : 1) + idx;
                  const score = sortKey === 'avgOverall' ? item.avgOverall : (item.averages[sortKey] || 0);
                  return (
                    <div key={item.id} className="mlb-row glass-panel" onClick={() => navigate(`${section.prefix}/${item.id}`)}>
                      <span className="mlb-rank">#{rank}</span>
                      {item.posterPath ? (
                        <img loading="lazy" src={tmdbImage(item.posterPath, 'w92')} alt={item.title} className="mlb-row-img" />
                      ) : (
                        <div className="mlb-row-placeholder" />
                      )}
                      <div className="mlb-row-info">
                        <p className="mlb-row-title">{item.title}</p>
                        <span className="mlb-row-count">{item.count} vote{item.count > 1 ? 's' : ''}</span>
                      </div>
                      <span className={`mlb-row-score ${getScoreColor(score)}`}>{score.toFixed(1)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};
