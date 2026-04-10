import { useState, useRef, useCallback } from 'react';
import {
  Upload, FileText, Play, ChevronRight, Trash2, ArrowLeft,
  CheckCircle2, AlertTriangle, XCircle, Loader2, ListMusic,
  SkipForward, Music, Save, Plus, GripVertical,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ref, set } from 'firebase/database';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { parseText, resolveAll, type ResolvedTheme, type ParsedLine } from '../utils/playlistParser';
import { refreshThemeRatingMeta } from '../utils/ratingMeta';
import './Playlist.css';

type Phase = 'input' | 'resolving' | 'review' | 'playing';

const STATUS_ICON = {
  found: <CheckCircle2 size={16} className="pl-status-ok" />,
  approx: <AlertTriangle size={16} className="pl-status-warn" />,
  'not-found': <XCircle size={16} className="pl-status-err" />,
};

const STATUS_LABEL = {
  found: 'Trouvé',
  approx: 'Résultat approché',
  'not-found': 'Non trouvé',
};

export const Playlist: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── State ──
  const [phase, setPhase] = useState<Phase>('input');
  const [rawText, setRawText] = useState('');
  const [items, setItems] = useState<ResolvedTheme[]>([]);
  const [resolveProgress, setResolveProgress] = useState(0);
  const [resolveTotal, setResolveTotal] = useState(0);

  // Playing state
  const [currentIdx, setCurrentIdx] = useState(0);
  const [scores, setScores] = useState<Record<number, { music: number; animation: number }>>({});
  const [savingIdx, setSavingIdx] = useState<number | null>(null);

  // ══════════════════════════════════
  // Phase 1: INPUT
  // ══════════════════════════════════

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100_000) {
      showToast('Fichier trop gros (max 100 Ko).', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setRawText(prev => prev ? prev + '\n' + reader.result : reader.result as string);
        showToast(`${file.name} importé !`, 'success');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const exampleText = `naruto op 1
jjk ed2
aot opening 3
bleach OP13
frieren op
chainsaw man ending 1
demon slayer ed 1
spy x family op`;

  // ══════════════════════════════════
  // Phase 2: RESOLVING
  // ══════════════════════════════════

  const handleResolve = async () => {
    const parsed = parseText(rawText);
    if (parsed.length === 0) {
      showToast('Aucune entrée détectée. Vérifie le format.', 'error');
      return;
    }
    if (parsed.length > 50) {
      showToast('Maximum 50 thèmes par playlist.', 'error');
      return;
    }

    setPhase('resolving');
    setResolveTotal(parsed.length);
    setResolveProgress(0);

    const results = await resolveAll(parsed, (idx) => {
      setResolveProgress(idx + 1);
    });

    setItems(results);
    setPhase('review');

    const found = results.filter(r => r.status === 'found').length;
    const approx = results.filter(r => r.status === 'approx').length;
    const notFound = results.filter(r => r.status === 'not-found').length;
    showToast(
      `${found} trouvé${found > 1 ? 's' : ''}, ${approx} approché${approx > 1 ? 's' : ''}, ${notFound} non trouvé${notFound > 1 ? 's' : ''}`,
      notFound > 0 ? 'error' : approx > 0 ? 'info' : 'success',
    );
  };

  // ══════════════════════════════════
  // Phase 3: REVIEW
  // ══════════════════════════════════

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const playableItems = items.filter(it => it.video);

  const handleStartPlaying = () => {
    if (playableItems.length === 0) {
      showToast('Aucun thème jouable dans la playlist.', 'error');
      return;
    }
    setPhase('playing');
    setCurrentIdx(0);
    // Initialize scores for all playable items
    const initScores: Record<number, { music: number; animation: number }> = {};
    playableItems.forEach((_, i) => { initScores[i] = { music: 50, animation: 50 }; });
    setScores(initScores);
  };

  // ══════════════════════════════════
  // Phase 4: PLAYING
  // ══════════════════════════════════

  const current = playableItems[currentIdx];
  const isLast = currentIdx === playableItems.length - 1;

  const handleSaveAndNext = async () => {
    if (!user || !current?.anime || !current?.theme) return;
    setSavingIdx(currentIdx);

    try {
      const myScores = scores[currentIdx] || { music: 50, animation: 50 };
      const themeId = current.theme.id;
      const themeSlug = `${current.theme.type}${current.theme.sequence || ''}`;

      // Save to user's themeRatings
      await set(ref(db, `users/${user.uid}/themeRatings/${themeId}`), {
        music: myScores.music,
        animation: myScores.animation,
        animeName: current.anime.name,
        animeId: current.anime.id,
        themeType: current.theme.type,
        themeSlug,
        timestamp: Date.now(),
      });

      // Save to global themeRatings
      await set(ref(db, `themeRatings/${themeId}/users/${user.uid}`), {
        music: myScores.music,
        animation: myScores.animation,
      });

      // Refresh meta
      await refreshThemeRatingMeta(themeId, {
        animeName: current.anime.name,
        animeId: current.anime.id,
        themeType: current.theme.type,
        themeSlug,
      });

      const avg = Math.round((myScores.music + myScores.animation) / 2);
      showToast(`${current.anime.name} — ${themeSlug} : ${avg}/100 ✓`, 'success');
    } catch {
      showToast('Erreur lors de la sauvegarde.', 'error');
    } finally {
      setSavingIdx(null);
    }

    // Move to next or finish
    if (!isLast) {
      setCurrentIdx(prev => prev + 1);
    } else {
      showToast('Playlist terminée ! Toutes les notes sont sauvegardées.', 'success');
      setPhase('review');
    }
  };

  const handleSkip = () => {
    if (!isLast) {
      setCurrentIdx(prev => prev + 1);
    } else {
      showToast('Playlist terminée !', 'info');
      setPhase('review');
    }
  };

  const updateScore = useCallback((key: 'music' | 'animation', val: number) => {
    setScores(prev => ({
      ...prev,
      [currentIdx]: { ...prev[currentIdx], [key]: val },
    }));
  }, [currentIdx]);

  // ══════════════════════════════════
  // RENDER
  // ══════════════════════════════════

  return (
    <div className="pl-container">
      <main className="pl-main">
        <button className="pl-back" onClick={() => navigate('/anime')}>
          <ArrowLeft size={18} /> Accueil
        </button>

        <div className="pl-hero">
          <div className="pl-hero-icon"><ListMusic size={36} /></div>
          <h1 className="pl-hero-title"><span className="text-gradient">Playlist de notation</span></h1>
          <p className="pl-hero-sub">Importe une liste d'OP/ED, on trouve les vidéos, tu notes tout d'un coup.</p>
        </div>

        {/* ═══ INPUT PHASE ═══ */}
        {phase === 'input' && (
          <div className="pl-input-section">
            <div className="pl-input-card glass-panel">
              <div className="pl-input-header">
                <FileText size={18} />
                <span>Colle ta liste ou importe un fichier .txt</span>
              </div>

              <textarea
                className="pl-textarea"
                placeholder={`Formats acceptés :\n\nnaruto op 1\njjk ed2\naot opening 3\nbleach OP13\nfrieren op\nchainsaw man ending 1\n\nAbréviations reconnues : snk, mha, csm, hxh, sao, fmab…`}
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                rows={12}
              />

              <div className="pl-input-actions">
                <button className="pl-btn-secondary" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={16} /> Importer .txt
                </button>
                <input ref={fileInputRef} type="file" accept=".txt,.text,text/plain" hidden onChange={handleFileUpload} />

                <button className="pl-btn-secondary" onClick={() => setRawText(exampleText)}>
                  <Plus size={16} /> Exemple
                </button>

                <button
                  className="pl-btn-primary"
                  onClick={handleResolve}
                  disabled={!rawText.trim()}
                >
                  <Play size={16} /> Résoudre ({parseText(rawText).length} thèmes)
                </button>
              </div>
            </div>

            <div className="pl-format-help glass-panel">
              <h3>Formats reconnus</h3>
              <ul>
                <li><code>naruto op 1</code> — classique</li>
                <li><code>jjk ed2</code> — abréviation collée</li>
                <li><code>aot opening 3</code> — mot complet</li>
                <li><code>frieren op</code> — sans numéro = OP1</li>
                <li><code>bleach OP13</code> — majuscules OK</li>
                <li><code>demon slayer - ed 1</code> — séparateurs ignorés</li>
              </ul>
              <p className="pl-format-note">Abréviations : snk, mha, csm, hxh, sao, fmab, jjk, kny, opm, ve, sg, cote…</p>
            </div>
          </div>
        )}

        {/* ═══ RESOLVING PHASE ═══ */}
        {phase === 'resolving' && (
          <div className="pl-resolving glass-panel">
            <Loader2 size={32} className="pl-spin" />
            <h2>Recherche en cours…</h2>
            <div className="pl-progress-bar">
              <div
                className="pl-progress-fill"
                style={{ width: `${(resolveProgress / resolveTotal) * 100}%` }}
              />
            </div>
            <p>{resolveProgress} / {resolveTotal} thèmes résolus</p>
          </div>
        )}

        {/* ═══ REVIEW PHASE ═══ */}
        {phase === 'review' && (
          <div className="pl-review">
            <div className="pl-review-header">
              <h2>{items.length} thème{items.length > 1 ? 's' : ''} dans la playlist</h2>
              <div className="pl-review-actions">
                <button className="pl-btn-secondary" onClick={() => setPhase('input')}>
                  <ArrowLeft size={15} /> Modifier
                </button>
                {!user && <p className="pl-login-warn">Connecte-toi pour noter !</p>}
                <button
                  className="pl-btn-primary"
                  onClick={handleStartPlaying}
                  disabled={playableItems.length === 0}
                >
                  <Play size={16} /> Lancer ({playableItems.length} jouable{playableItems.length > 1 ? 's' : ''})
                </button>
              </div>
            </div>

            <div className="pl-review-list">
              {items.map((item, idx) => (
                <div key={idx} className={`pl-review-item glass-panel pl-status-${item.status}`}>
                  <div className="pl-item-grip"><GripVertical size={14} /></div>
                  <div className="pl-item-num">{idx + 1}</div>
                  <div className="pl-item-status">{STATUS_ICON[item.status]}</div>
                  <div className="pl-item-info">
                    <div className="pl-item-raw">{item.parsed.raw}</div>
                    <div className="pl-item-match">
                      {item.status === 'not-found' ? (
                        <span className="pl-match-err">Aucun résultat</span>
                      ) : (
                        <>
                          <span className="pl-match-name">{item.matchedName}</span>
                          {item.theme && (
                            <span className="pl-match-theme">
                              {item.theme.type}{item.theme.sequence || ''}
                            </span>
                          )}
                          <span className="pl-match-label">{STATUS_LABEL[item.status]}</span>
                          {!item.video && <span className="pl-match-novideo">Pas de vidéo</span>}
                        </>
                      )}
                    </div>
                  </div>
                  <button className="pl-item-remove" onClick={() => removeItem(idx)} title="Retirer">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ PLAYING PHASE ═══ */}
        {phase === 'playing' && current && (
          <div className="pl-player">
            {/* Progress bar */}
            <div className="pl-player-progress">
              <span>{currentIdx + 1} / {playableItems.length}</span>
              <div className="pl-progress-bar pl-progress-bar-sm">
                <div
                  className="pl-progress-fill"
                  style={{ width: `${((currentIdx + 1) / playableItems.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Video */}
            <div className="pl-player-video glass-panel">
              <div className="pl-player-header">
                <div>
                  <h2>{current.anime!.name}</h2>
                  <span className="pl-player-theme-tag">
                    {current.theme!.type}{current.theme!.sequence || ''}
                  </span>
                </div>
              </div>

              {current.video ? (
                <video
                  key={current.video.link}
                  controls
                  autoPlay
                  className="pl-video"
                >
                  <source src={current.video.link} type="video/webm" />
                </video>
              ) : (
                <div className="pl-no-video">
                  <Music size={32} />
                  <p>Pas de vidéo</p>
                </div>
              )}
            </div>

            {/* Rating sliders */}
            <div className="pl-player-rating glass-panel">
              <h3>Note ce thème</h3>
              <div className="pl-slider-row">
                <label>
                  <Music size={14} />
                  <span>Musique</span>
                </label>
                <input
                  type="range" min={0} max={100}
                  value={scores[currentIdx]?.music ?? 50}
                  onChange={e => updateScore('music', Number(e.target.value))}
                />
                <span className="pl-slider-val">{scores[currentIdx]?.music ?? 50}</span>
              </div>
              <div className="pl-slider-row">
                <label>
                  <Play size={14} />
                  <span>Animation</span>
                </label>
                <input
                  type="range" min={0} max={100}
                  value={scores[currentIdx]?.animation ?? 50}
                  onChange={e => updateScore('animation', Number(e.target.value))}
                />
                <span className="pl-slider-val">{scores[currentIdx]?.animation ?? 50}</span>
              </div>
              <div className="pl-player-overall">
                Global : {Math.round(((scores[currentIdx]?.music ?? 50) + (scores[currentIdx]?.animation ?? 50)) / 2)}/100
              </div>
            </div>

            {/* Actions */}
            <div className="pl-player-actions">
              <button className="pl-btn-secondary" onClick={handleSkip}>
                <SkipForward size={16} /> Passer
              </button>
              <button
                className="pl-btn-primary"
                onClick={handleSaveAndNext}
                disabled={!user || savingIdx !== null}
              >
                {savingIdx !== null ? (
                  <Loader2 size={16} className="pl-spin" />
                ) : (
                  <Save size={16} />
                )}
                {isLast ? 'Sauvegarder & Terminer' : 'Sauvegarder & Suivant'}
              </button>
            </div>

            {/* Upcoming list */}
            {playableItems.length > 1 && (
              <div className="pl-upcoming glass-panel">
                <h4>File d'attente</h4>
                <div className="pl-upcoming-list">
                  {playableItems.map((it, i) => (
                    <div
                      key={i}
                      className={`pl-upcoming-item ${i === currentIdx ? 'pl-upcoming-current' : ''} ${i < currentIdx ? 'pl-upcoming-done' : ''}`}
                    >
                      <span className="pl-upcoming-num">{i + 1}</span>
                      <span className="pl-upcoming-name">{it.anime!.name}</span>
                      <span className="pl-upcoming-tag">{it.theme!.type}{it.theme!.sequence || ''}</span>
                      {i < currentIdx && <CheckCircle2 size={12} className="pl-status-ok" />}
                      {i === currentIdx && <ChevronRight size={14} />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
