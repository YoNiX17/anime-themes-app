import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ref, onValue, query, limitToLast, orderByChild, set } from 'firebase/database';
import { 
  Users, Copy, Play, Search, Check, 
  Send, Smile, X, Clock, MessageCircle, Crown, Trash2, Loader2,
  CheckCircle, Trophy, ArrowRight, Palette, Music
} from 'lucide-react';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { searchAnime } from '../services/api';
import { 
  selectThemeForRoom, startPlayback, moveToVoting, triggerReveal, 
  resetToWaiting, setUserReady, submitScore, sendChatMessage, 
  closePartyRoom, joinPartyPresence, saveToHistory 
} from '../services/party';
import { useToast } from '../components/Toast';
import { refreshThemeRatingMeta } from '../utils/ratingMeta';
import type { PartyRoom as PartyRoomType, PartyUser, ChatMessage, ThemeScore } from '../services/party';
import type { Anime, AnimeTheme } from '../services/api';
import './PartyRoom.css';
import { Header } from '../components/Header';

const REACTIONS = ['🔥', '❤️', '🎵', '✨', '😍', '👏', '💯', '🤯'];

const SCORE_CATEGORIES = [
  { key: 'music' as const, label: 'Musique', icon: Music, color: '#f72585' },
  { key: 'animation' as const, label: 'Animation', icon: Palette, color: '#06b6d4' },
];

const defaultPartyScores: ThemeScore = { music: 50, animation: 50 };

const getScoreAvg = (score: ThemeScore | null | undefined): number => {
  if (!score) return 0;
  return (score.music + score.animation) / 2;
};

export const PartyRoom: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [room, setRoom] = useState<PartyRoomType | null>(null);
  const [users, setUsers] = useState<Record<string, PartyUser>>({});
  const [chatMessages, setChatMessages] = useState<(ChatMessage & { id: string })[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Anime[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [copied, setCopied] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [showReactions, setShowReactions] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const [myScores, setMyScores] = useState<ThemeScore>({ ...defaultPartyScores });
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [revealVisible, setRevealVisible] = useState(false);
  const [clockOffset, setClockOffset] = useState(0);
  const reactionIdRef = useRef(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ──────── Firebase clock offset ────────
  useEffect(() => {
    const offsetRef = ref(db, '.info/serverTimeOffset');
    const unsub = onValue(offsetRef, (snapshot) => {
      setClockOffset(snapshot.val() || 0);
    });
    return () => unsub();
  }, []);

  // ──────── Firebase subscriptions ────────
  useEffect(() => {
    if (!id) { navigate('/'); return; }

    const roomRef = ref(db, `parties/${id}`);
    const unsubRoom = onValue(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setRoom({ ...data, id });
        // When reveal phase starts, trigger animation
        if (data.phase === 'reveal') {
          setTimeout(() => setRevealVisible(true), 300);
        } else {
          setRevealVisible(false);
        }
      } else {
        showToast("Cette party n'existe pas ou a été fermée.", "error");
        navigate('/');
      }
    });

    const usersRef = ref(db, `parties/${id}/users`);
    const unsubUsers = onValue(usersRef, (snapshot) => {
      setUsers(snapshot.exists() ? snapshot.val() : {});
    });

    const chatRef = query(ref(db, `parties/${id}/chat`), orderByChild('timestamp'), limitToLast(50));
    const unsubChat = onValue(chatRef, (snapshot) => {
      if (snapshot.exists()) {
        const msgs: (ChatMessage & { id: string })[] = [];
        snapshot.forEach((child) => {
          const val = child.val();
          msgs.push({ ...val, id: child.key! });
          if (val.type === 'reaction') triggerFloatingReaction(val.text);
        });
        setChatMessages(msgs);
      } else {
        setChatMessages([]);
      }
    });

    // Join presence with onDisconnect cleanup
    if (user) {
      joinPartyPresence(id, user.uid, user.displayName || user.email?.split('@')[0] || 'User');
    }

    return () => { unsubRoom(); unsubUsers(); unsubChat(); };
  }, [id, user, navigate]);

  // Reset submission state when phase changes away from voting
  useEffect(() => {
    if (room?.phase !== 'voting' && room?.phase !== 'reveal') {
      setHasSubmitted(false);
      setMyScores({ ...defaultPartyScores });
    }
  }, [room?.phase]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Video sync — when playing phase starts, sync to server timestamp using clock offset
  useEffect(() => {
    if (room?.phase === 'playing' && room.currentTheme?.startedAt && videoRef.current) {
      const video = videoRef.current;
      const serverNow = Date.now() + clockOffset;
      const elapsed = (serverNow - room.currentTheme.startedAt) / 1000;
      const duration = video.duration;
      // Only seek if elapsed is valid and within the video duration
      if (elapsed > 0 && (isNaN(duration) || elapsed < duration)) {
        video.currentTime = Math.min(elapsed, isNaN(duration) ? elapsed : duration);
        video.play().catch(() => {});
      }
    }
  }, [room?.phase, room?.currentTheme?.startedAt, clockOffset]);

  // Periodic video re-sync every 3 seconds during playback
  useEffect(() => {
    if (room?.phase === 'playing' && room.currentTheme?.startedAt) {
      syncIntervalRef.current = setInterval(() => {
        if (!videoRef.current || !room.currentTheme?.startedAt) return;
        const serverNow = Date.now() + clockOffset;
        const expectedTime = (serverNow - room.currentTheme.startedAt) / 1000;
        const actualTime = videoRef.current.currentTime;
        const duration = videoRef.current.duration;
        const drift = Math.abs(expectedTime - actualTime);
        
        // Only correct if drift > 0.5 seconds and within video duration
        if (drift > 0.5 && expectedTime > 0 && (!isNaN(duration) ? expectedTime < duration : expectedTime < 300)) {
          videoRef.current.currentTime = Math.min(expectedTime, isNaN(duration) ? expectedTime : duration);
        }
      }, 3000);

      return () => {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
          syncIntervalRef.current = null;
        }
      };
    } else {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    }
  }, [room?.phase, room?.currentTheme?.startedAt, clockOffset]);

  // Video ended → host auto-moves to voting
  const handleVideoEnded = useCallback(() => {
    if (!id || !room || room.hostId !== user?.uid) return;
    moveToVoting(id);
  }, [id, room, user]);

  const triggerFloatingReaction = (emoji: string) => {
    const rid = reactionIdRef.current++;
    const x = 10 + Math.random() * 80;
    setFloatingReactions(prev => [...prev, { id: rid, emoji, x }]);
    setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== rid)), 2500);
  };

  // ──────── Host actions ────────
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoadingSearch(true);
    try { setSearchResults(await searchAnime(searchQuery)); }
    catch { showToast("Recherche échouée.", "error"); }
    finally { setLoadingSearch(false); }
  };

  const handleSelectTheme = async (anime: Anime, theme: AnimeTheme) => {
    if (!id || room?.hostId !== user?.uid) return;
    const entry = theme.animethemeentries?.[0];
    const video = (entry && entry.videos?.length > 0) ? entry.videos[0] : null;
    await selectThemeForRoom(id, anime, theme, video);
    setSearchResults([]);
    setSearchQuery('');
    showToast(`Thème sélectionné : ${anime.name} — ${theme.type}${theme.sequence || ''}`, "success");
  };

  const handleStartPlayback = async () => {
    if (!id) return;
    await startPlayback(id);
  };

  const handleMoveToVoting = async () => {
    if (!id) return;
    await moveToVoting(id);
  };

  const handleTriggerReveal = async () => {
    if (!id || !room?.currentTheme) return;
    const scores: Record<string, ThemeScore> = {};
    Object.entries(users).forEach(([uid, u]) => {
      if (u.score != null) scores[uid] = u.score;
    });
    await saveToHistory(
      id,
      room.currentTheme.anime.name,
      `${room.currentTheme.theme.type}${room.currentTheme.theme.sequence || ''}`,
      scores
    );
    await triggerReveal(id);
  };

  const handleNextTheme = async () => {
    if (!id) return;
    await resetToWaiting(id, users);
  };

  const handleCloseRoom = async () => {
    if (!id) return;
    showToast("Party fermée.", "info");
    await closePartyRoom(id);
    navigate('/');
  };

  // ──────── User actions ────────
  const handleToggleReady = async () => {
    if (!user || !id) return;
    const currentReady = users[user.uid]?.ready || false;
    await setUserReady(id, user.uid, !currentReady);
  };

  const handleSubmitScore = async () => {
    if (!user || !id || hasSubmitted) return;
    await submitScore(id, user.uid, myScores);
    // Persist to themeRatings so it appears in Profile & Leaderboard
    const theme = room?.currentTheme;
    if (theme) {
      const themeId = theme.theme.id;
      const themeSlug = `${theme.theme.type}${theme.theme.sequence || ''}`;
      const saveData = {
        music: myScores.music,
        animation: myScores.animation,
        animeName: theme.anime.name,
        animeId: theme.anime.id,
        themeType: theme.theme.type,
        themeSlug,
        timestamp: Date.now(),
      };
      // Save to user's personal themeRatings
      await set(ref(db, `users/${user.uid}/themeRatings/${themeId}`), saveData);
      // Save to global themeRatings
      await set(ref(db, `themeRatings/${themeId}/users/${user.uid}`), {
        music: myScores.music,
        animation: myScores.animation,
      });
      // Refresh aggregated meta
      await refreshThemeRatingMeta(themeId, {
        animeName: theme.anime.name,
        animeId: theme.anime.id,
        themeType: theme.theme.type,
        themeSlug,
      });
    }
    setHasSubmitted(true);
    const avg = Math.round(getScoreAvg(myScores));
    showToast(`Notes envoyées ! Moyenne : ${avg}/100`, "success");
  };

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    showToast("Lien d'invitation copié !", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !user || !id) return;
    const text = chatInput.trim();
    setChatInput('');
    await sendChatMessage(id, user.uid, user.displayName || user.email?.split('@')[0] || 'User', text);
  };

  const handleReaction = async (emoji: string) => {
    if (!user || !id) return;
    setShowReactions(false);
    triggerFloatingReaction(emoji);
    await sendChatMessage(id, user.uid, user.displayName || 'User', emoji, 'reaction');
  };

  // ──────── Derived state ────────
  if (!user) {
    return (
      <div className="party-room-container">
        <Header />
        <div className="glass-panel party-auth-msg">
          <Users size={40} style={{ color: 'var(--accent-primary-light)', marginBottom: '1rem' }} />
          <h2>Connexion requise</h2>
          <p>Connecte-toi via le bouton dans le header pour rejoindre cette party.</p>
        </div>
      </div>
    );
  }

  const isHost = room?.hostId === user.uid;
  const userList = Object.entries(users);
  const allReady = userList.length > 0 && userList.every(([, u]) => u.ready);
  const allVoted = userList.length > 0 && userList.every(([, u]) => u.score != null);
  const votedCount = userList.filter(([, u]) => u.score != null).length;
  const readyCount = userList.filter(([, u]) => u.ready).length;
  const phase = room?.phase || 'waiting';

  return (
    <div className="party-room-container">
      <Header />
      
      <main className="party-main-content">
        {/* ═══ Header ═══ */}
        <div className="party-header glass-panel">
          <div>
            <h2>
              Rating Party
              {phase === 'playing' && <span className="live-badge">LIVE</span>}
              {phase === 'voting' && <span className="vote-badge">VOTE</span>}
              {phase === 'reveal' && <span className="reveal-badge-header">REVEAL</span>}
            </h2>
            <div className="party-meta">
              <span className="party-users"><Users size={16} /> {userList.length}</span>
              {isHost && <span className="host-badge">HOST</span>}
            </div>
          </div>
          <div className="party-header-actions">
            <button className={`invite-btn ${copied ? 'invite-copied' : ''}`} onClick={handleCopyInvite}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copié !' : 'Invite'}
            </button>
            {isHost && (
              <button className="close-room-btn" onClick={handleCloseRoom} title="Fermer la party">
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="party-layout">
          {/* ═══ Left: Main Area ═══ */}
          <div className="player-area">
            
            {/* ── WAITING ── */}
            {phase === 'waiting' && !room?.currentTheme && (
              <div className="waiting-container glass-panel">
                <Play size={56} className="waiting-icon" />
                <h3>En attente...</h3>
                <p>{isHost ? 'Cherche un anime ci-dessous pour lancer un thème.' : 'Le host va sélectionner un OP ou ED.'}</p>
              </div>
            )}

            {/* ── READY CHECK ── */}
            {phase === 'ready-check' && room?.currentTheme && (
              <div className="ready-check-container glass-panel">
                <div className="ready-theme-preview">
                  <h3 className="ready-anime-name">{room.currentTheme.anime.name}</h3>
                  <span className="ready-theme-badge">
                    {room.currentTheme.theme.type}{room.currentTheme.theme.sequence || ''}
                  </span>
                </div>
                
                <div className="ready-status">
                  <div className="ready-progress-ring">
                    <svg viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" className="ring-bg" />
                      <circle cx="50" cy="50" r="42" className="ring-fill" 
                        style={{ strokeDasharray: `${(readyCount / Math.max(userList.length, 1)) * 264} 264` }} />
                    </svg>
                    <span className="ring-text">{readyCount}/{userList.length}</span>
                  </div>
                  <p className="ready-label">Joueurs prêts</p>
                </div>

                <div className="ready-users-grid">
                  {userList.map(([uid, u]) => (
                    <div key={uid} className={`ready-user-chip ${u.ready ? 'is-ready' : ''}`}>
                      <span className="ready-user-avatar">{(u.displayName || '?')[0].toUpperCase()}</span>
                      <span className="ready-user-name">{u.displayName}</span>
                      {u.ready ? <CheckCircle size={16} className="ready-check-icon" /> : <Clock size={16} className="ready-wait-icon" />}
                    </div>
                  ))}
                </div>

                {!isHost && (
                  <button 
                    className={`ready-btn ${users[user.uid]?.ready ? 'is-ready' : ''}`} 
                    onClick={handleToggleReady}
                  >
                    {users[user.uid]?.ready ? (
                      <><CheckCircle size={20} /> Prêt !</>
                    ) : (
                      <><Play size={20} /> Je suis prêt</>
                    )}
                  </button>
                )}

                {isHost && (
                  <div className="host-ready-actions">
                    <button 
                      className={`ready-btn ${users[user.uid]?.ready ? 'is-ready' : ''}`} 
                      onClick={handleToggleReady}
                    >
                      {users[user.uid]?.ready ? <><CheckCircle size={20} /> Prêt !</> : <><Play size={20} /> Je suis prêt</>}
                    </button>
                    <button 
                      className="start-btn" 
                      onClick={handleStartPlayback}
                      disabled={!allReady}
                      title={allReady ? 'Lancer !' : 'Tout le monde doit être prêt'}
                    >
                      <Play size={20} fill="white" />
                      {allReady ? 'Lancer !' : `Attendre (${readyCount}/${userList.length})`}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── PLAYING ── */}
            {phase === 'playing' && room?.currentTheme && (
              <div className="playing-container glass-panel">
                <div className="playing-header">
                  <h3>{room.currentTheme.anime.name}</h3>
                  <span className="playing-theme-badge">
                    {room.currentTheme.theme.type}{room.currentTheme.theme.sequence || ''}
                  </span>
                </div>
                
                {room.currentTheme.video ? (
                  <div className="video-wrapper">
                    <video 
                      ref={videoRef}
                      key={room.currentTheme.video.link}
                      controls={isHost}
                      autoPlay 
                      className="party-video-player"
                      onEnded={handleVideoEnded}
                    >
                      <source src={room.currentTheme.video.link} type="video/webm" />
                    </video>
                    {!isHost && <div className="video-overlay-no-controls" />}
                    {floatingReactions.map(r => (
                      <span key={r.id} className="floating-reaction" style={{ left: `${r.x}%` }}>{r.emoji}</span>
                    ))}
                  </div>
                ) : (
                  <div className="party-no-video">
                    <Music size={48} />
                    <p>Pas de vidéo disponible</p>
                  </div>
                )}

                <p className="playing-hint">🎧 Écoute attentivement... Tu voteras à la fin !</p>
                
                {isHost && (
                  <button className="force-vote-btn" onClick={handleMoveToVoting}>
                    <ArrowRight size={16} /> Passer au vote
                  </button>
                )}
              </div>
            )}

            {/* ── VOTING ── */}
            {phase === 'voting' && room?.currentTheme && (
              <div className="voting-container glass-panel">
                <div className="voting-theme-info">
                  <h3>{room.currentTheme.anime.name}</h3>
                  <span className="voting-theme-badge">
                    {room.currentTheme.theme.type}{room.currentTheme.theme.sequence || ''}
                  </span>
                </div>

                {!hasSubmitted ? (
                  <div className="score-input-section">
                    <h2 className="vote-title">Tes notes</h2>
                    
                    {SCORE_CATEGORIES.map(({ key, label, icon: Icon, color }) => (
                      <div key={key} className="dual-score-block">
                        <div className="dual-score-label">
                          <Icon size={18} style={{ color }} />
                          <span>{label}</span>
                        </div>
                        <div className="score-display-big">
                          <span className="score-number" style={{ color }}>{myScores[key]}</span>
                          <span className="score-max">/100</span>
                        </div>
                        <div className="slider-container">
                          <div className="slider-track">
                            <div className="slider-fill" style={{ width: `${myScores[key]}%`, background: color }} />
                          </div>
                          <input 
                            type="range" min={0} max={100} value={myScores[key]} 
                            onChange={e => setMyScores(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                            className="score-slider"
                          />
                        </div>
                      </div>
                    ))}

                    <div className="vote-overall-preview">
                      <span>Moyenne :</span>
                      <strong>{Math.round(getScoreAvg(myScores))}/100</strong>
                    </div>

                    <button className="submit-score-btn" onClick={handleSubmitScore}>
                      <Send size={18} />
                      Envoyer mes notes
                    </button>
                  </div>
                ) : (
                  <div className="vote-waiting">
                    <CheckCircle size={48} className="vote-check-icon" />
                    <h3>Notes envoyées !</h3>
                    <p>En attente des autres joueurs... ({votedCount}/{userList.length})</p>
                    <div className="vote-progress-bar">
                      <div className="vote-progress-fill" style={{ width: `${(votedCount / Math.max(userList.length, 1)) * 100}%` }} />
                    </div>
                  </div>
                )}

                {isHost && allVoted && (
                  <button className="reveal-trigger-btn" onClick={handleTriggerReveal}>
                    <Trophy size={20} />
                    Révéler les notes !
                  </button>
                )}
              </div>
            )}

            {/* ── REVEAL ── */}
            {phase === 'reveal' && room?.currentTheme && (
              <div className="reveal-container glass-panel">
                <h2 className="reveal-title">
                  <Trophy size={28} className="trophy-icon" />
                  Résultats
                </h2>
                <div className="reveal-theme-info">
                  {room.currentTheme.anime.name} — {room.currentTheme.theme.type}{room.currentTheme.theme.sequence || ''}
                </div>

                <div className="reveal-cards">
                  {userList.map(([uid, u], i) => (
                    <div 
                      key={uid} 
                      className={`reveal-card ${revealVisible ? 'revealed' : ''}`}
                      style={{ animationDelay: `${i * 0.15}s` }}
                    >
                      <div className="reveal-card-inner">
                        <div className="reveal-card-front">?</div>
                        <div className="reveal-card-back">
                          <div className="reveal-avatar">{(u.displayName || '?')[0].toUpperCase()}</div>
                          <span className="reveal-name">{u.displayName}</span>
                          <div className="reveal-dual-scores">
                            {SCORE_CATEGORIES.map(({ key, icon: Icon, color }) => (
                              <div key={key} className="reveal-score-category">
                                <Icon size={11} style={{ color }} />
                                <span className="reveal-score">{u.score?.[key] ?? '—'}</span>
                              </div>
                            ))}
                          </div>
                          <span className="reveal-avg-personal">
                            Ø {u.score ? Math.round(getScoreAvg(u.score)) : '—'}
                          </span>
                          {uid === room.hostId && <Crown size={14} className="reveal-crown" />}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Averages */}
                {revealVisible && (
                  <div className="reveal-averages-row">
                    {SCORE_CATEGORIES.map(({ key, label, icon: Icon, color }) => (
                      <div key={key} className="reveal-average">
                        <Icon size={14} style={{ color }} />
                        <span className="average-label">{label}</span>
                        <span className="average-score">
                          {(userList.reduce((sum, [, u]) => sum + (u.score?.[key] || 0), 0) / Math.max(userList.length, 1)).toFixed(0)}
                        </span>
                        <span className="average-max">/100</span>
                      </div>
                    ))}
                    <div className="reveal-average reveal-average-global">
                      <Trophy size={14} style={{ color: '#fbbf24' }} />
                      <span className="average-label">Global</span>
                      <span className="average-score average-score-global">
                        {(userList.reduce((sum, [, u]) => sum + getScoreAvg(u.score), 0) / Math.max(userList.length, 1)).toFixed(0)}
                      </span>
                      <span className="average-max">/100</span>
                    </div>
                  </div>
                )}

                {isHost && (
                  <button className="next-theme-btn" onClick={handleNextTheme}>
                    <ArrowRight size={18} />
                    Thème suivant
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ═══ Right sidebar ═══ */}
          <div className="party-sidebar">
            {/* Participants */}
            <div className="sidebar-section glass-panel">
              <h4 className="sidebar-title"><Users size={16} /> Joueurs ({userList.length})</h4>
              <div className="participants-list">
                {userList.map(([uid, u]) => (
                  <div key={uid} className={`participant-item ${uid === room?.hostId ? 'is-host' : ''}`}>
                    <div className="participant-avatar">{(u.displayName || '?')[0].toUpperCase()}</div>
                    <span className="participant-name">{u.displayName || 'Anonymous'}</span>
                    {uid === room?.hostId && <Crown size={14} className="host-crown" />}
                    {phase === 'ready-check' && u.ready && <CheckCircle size={14} className="participant-ready" />}
                    {phase === 'voting' && u.score != null && <Check size={14} className="participant-voted" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Chat */}
            <div className="sidebar-section chat-section glass-panel">
              <h4 className="sidebar-title"><MessageCircle size={16} /> Chat</h4>
              <div className="chat-messages">
                {chatMessages.length === 0 ? (
                  <p className="chat-empty">Pas encore de messages...</p>
                ) : (
                  chatMessages.map((msg) => (
                    <div key={msg.id} className={`chat-msg ${msg.type === 'reaction' ? 'chat-reaction' : ''} ${msg.userId === user.uid ? 'chat-own' : ''}`}>
                      {msg.type === 'reaction' ? (
                        <span className="reaction-bubble">{msg.text}</span>
                      ) : (
                        <>
                          <span className="chat-author">{msg.userId === user.uid ? 'Toi' : msg.displayName}</span>
                          <span className="chat-text">{msg.text}</span>
                        </>
                      )}
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="chat-input-area">
                <div className="reaction-bar-wrapper">
                  <button className="reaction-toggle" onClick={() => setShowReactions(!showReactions)}><Smile size={18} /></button>
                  {showReactions && (
                    <div className="reaction-picker">
                      {REACTIONS.map(emoji => (
                        <button key={emoji} className="reaction-pick-btn" onClick={() => handleReaction(emoji)}>{emoji}</button>
                      ))}
                    </div>
                  )}
                </div>
                <form onSubmit={handleSendChat} className="chat-form">
                  <input type="text" placeholder="Message..." value={chatInput} onChange={e => setChatInput(e.target.value)} className="chat-input" maxLength={500} />
                  <button type="submit" className="chat-send-btn" disabled={!chatInput.trim()}><Send size={16} /></button>
                </form>
              </div>
            </div>

            {/* History */}
            {room?.playHistory && (
              <div className="sidebar-section glass-panel">
                <h4 className="sidebar-title"><Clock size={16} /> Historique</h4>
                <div className="history-list">
                  {Object.values(room.playHistory).slice(-6).reverse().map((h: any, i: number) => {
                    let avg: string | null = null;
                    if (h.scores) {
                      const vals = Object.values(h.scores) as any[];
                      if (vals.length > 0) {
                        const total = vals.reduce((sum: number, s: any) => {
                          if (typeof s === 'object' && s !== null) {
                            const keys = ['music', 'animation'];
                            const catSum = keys.reduce((a, k) => a + (s[k] || 0), 0);
                            return sum + catSum / keys.length;
                          }
                          return sum + (typeof s === 'number' ? s : 0);
                        }, 0);
                        avg = (total / vals.length).toFixed(0);
                      }
                    }
                    return (
                      <div key={i} className="history-item">
                        <span className="history-theme-badge">{h.themeSlug}</span>
                        <span className="history-anime-name">{h.animeName}</span>
                        {avg && <span className="history-avg">Ø {avg}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ Host search — bottom panel ═══ */}
        {isHost && phase === 'waiting' && (
          <div className="host-controls glass-panel">
            <h3><Search size={18} /> Choisir un thème</h3>
            <form onSubmit={handleSearch} className="host-search-form">
              <input type="text" placeholder="Ex: KNY, SNK, Naruto..." value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)} className="host-search-input" />
              <button type="submit" disabled={loadingSearch} className="host-search-btn">
                {loadingSearch ? <Loader2 size={18} className="search-spinner" /> : <Search size={18} />}
              </button>
            </form>
            {searchResults.length > 0 && (
              <div className="search-results-grid">
                <div className="search-results-header">
                  <span>{searchResults.length} résultats</span>
                  <button className="clear-results-btn" onClick={() => setSearchResults([])}><X size={14} /> Fermer</button>
                </div>
                {searchResults.map(anime => (
                  <div key={anime.id} className="search-result-item">
                    {anime.images?.[0] && <img src={anime.images[0].link} alt="" className="search-result-img" />}
                    <div className="search-result-info">
                      <h4>{anime.name}</h4>
                      <span className="search-result-meta">{anime.year} · {anime.season}</span>
                      <div className="theme-buttons">
                        {anime.animethemes?.map(theme => (
                          <button key={theme.id} onClick={() => handleSelectTheme(anime, theme)} className="play-theme-btn">
                            <Play size={12} /> {theme.type}{theme.sequence || ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
