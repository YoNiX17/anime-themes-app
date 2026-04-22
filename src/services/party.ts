import { ref, set, push, get, serverTimestamp, remove, onDisconnect } from 'firebase/database';
import { db } from './firebase';
import type { Anime, AnimeTheme, Video } from './api';

/* ═══════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════ */

export type RoomPhase = 'waiting' | 'ready-check' | 'playing' | 'voting' | 'reveal';

export interface AnimeScore {
  plot: number;
  characters: number;
  animation: number;
  ost: number;
  pacing: number;
}

export interface ThemeScore {
  music: number;
  animation: number;
}

export interface PartyUser {
  displayName: string;
  joinedAt: number;
  ready?: boolean;         // ready-check phase
  score?: ThemeScore | null;   // voting phase (0-100 per category)
}

export interface ChatMessage {
  id?: string;
  userId: string;
  displayName: string;
  text: string;
  timestamp: number;
  type: 'message' | 'reaction';
}

export interface ThemeSelection {
  anime: { id: number; name: string; slug: string; year: number; season: string };
  theme: { id: number; slug: string; type: string; sequence: number };
  video: { id: number; basename: string; link: string; resolution: number } | null;
  startedAt: number; // Server timestamp for video sync
}

export interface QueueItem {
  anime: { id: number; name: string; slug: string; year: number; season: string };
  theme: { id: number; slug: string; type: string; sequence: number };
  video: { id: number; basename: string; link: string; resolution: number } | null;
  addedBy?: string;      // uid of the user who added this theme (missing on legacy items → treated as host)
  addedByName?: string;  // display name snapshot for UI
  addedAt?: number;      // timestamp (serverTimestamp), used for stable ordering / tie-break
}

export interface PartyRoom {
  id: string;
  hostId: string;
  createdAt: number;
  phase: RoomPhase;
  currentTheme: ThemeSelection | null;
  themeQueue?: QueueItem[];
  users?: Record<string, PartyUser>;
  chat?: Record<string, ChatMessage>;
  playHistory?: Record<string, {
    animeName: string;
    themeSlug: string;
    playedAt: number;
    scores?: Record<string, number>;
  }>;
}

/* ═══════════════════════════════════════════
   ROOM LIFECYCLE
   ═══════════════════════════════════════════ */

export const createPartyRoom = async (hostId: string): Promise<string> => {
  const roomsRef = ref(db, 'parties');
  const newRoomRef = push(roomsRef);
  const roomId = newRoomRef.key as string;

  await set(newRoomRef, {
    hostId,
    createdAt: serverTimestamp(),
    phase: 'waiting',
    currentTheme: null,
  });

  return roomId;
};

export const closePartyRoom = async (roomId: string) => {
  await remove(ref(db, `parties/${roomId}`));
};

/* ═══════════════════════════════════════════
   PRESENCE — with onDisconnect cleanup
   ═══════════════════════════════════════════ */

export const joinPartyPresence = async (roomId: string, userId: string, displayName: string) => {
  const presenceRef = ref(db, `parties/${roomId}/users/${userId}`);
  await set(presenceRef, {
    displayName,
    joinedAt: serverTimestamp(),
    ready: false,
    score: null,
  });
  // Auto-remove on disconnect
  onDisconnect(presenceRef).remove();
};

export const leavePartyPresence = async (roomId: string, userId: string) => {
  await remove(ref(db, `parties/${roomId}/users/${userId}`));
};

/* ═══════════════════════════════════════════
   PHASE TRANSITIONS (host only)
   ═══════════════════════════════════════════ */

/**
 * Any participant can add a theme to the queue (does NOT start it).
 * `addedBy` lets us show who queued what and let that user remove their own entry.
 */
export const addThemeToQueue = async (
  roomId: string,
  anime: Anime,
  theme: AnimeTheme,
  video: Video | null,
  addedBy?: string,
  addedByName?: string,
) => {
  const queueRef = ref(db, `parties/${roomId}/themeQueue`);
  const snap = await get(queueRef);
  const queue: QueueItem[] = snap.exists() ? snap.val() : [];
  queue.push({
    anime: { id: anime.id, name: anime.name, slug: anime.slug, year: anime.year, season: anime.season },
    theme: { id: theme.id, slug: theme.slug, type: theme.type, sequence: theme.sequence },
    video: video ? { id: video.id, basename: video.basename, link: video.link, resolution: video.resolution } : null,
    ...(addedBy ? { addedBy } : {}),
    ...(addedByName ? { addedByName } : {}),
    addedAt: Date.now(),
  });
  await set(queueRef, queue);
};

/**
 * Host removes a theme from the queue by index
 */
export const removeFromQueue = async (roomId: string, index: number) => {
  const queueRef = ref(db, `parties/${roomId}/themeQueue`);
  const snap = await get(queueRef);
  if (!snap.exists()) return;
  const queue: QueueItem[] = snap.val();
  queue.splice(index, 1);
  await set(queueRef, queue);
};

/**
 * Host selects a theme directly (single pick) → moves to ready-check
 */
export const selectThemeForRoom = async (
  roomId: string, anime: Anime, theme: AnimeTheme, video: Video | null
) => {
  await set(ref(db, `parties/${roomId}/currentTheme`), {
    anime: { id: anime.id, name: anime.name, slug: anime.slug, year: anime.year, season: anime.season },
    theme: { id: theme.id, slug: theme.slug, type: theme.type, sequence: theme.sequence },
    video: video ? { id: video.id, basename: video.basename, link: video.link, resolution: video.resolution } : null,
    startedAt: null,
  });
  await set(ref(db, `parties/${roomId}/phase`), 'ready-check');
};

/**
 * Host starts the queue → pops first item, moves to ready-check
 */
export const startQueue = async (roomId: string) => {
  const queueRef = ref(db, `parties/${roomId}/themeQueue`);
  const snap = await get(queueRef);
  if (!snap.exists()) return;
  const queue: QueueItem[] = snap.val();
  if (queue.length === 0) return;
  
  const first = queue.shift()!;
  await set(queueRef, queue.length > 0 ? queue : null);
  
  await set(ref(db, `parties/${roomId}/currentTheme`), {
    ...first,
    startedAt: null,
  });
  await set(ref(db, `parties/${roomId}/phase`), 'ready-check');
};

/**
 * Host starts playback → moves to playing, sets startedAt for sync
 */
export const startPlayback = async (roomId: string) => {
  const phaseRef = ref(db, `parties/${roomId}/phase`);
  const snap = await get(phaseRef);
  if (snap.val() !== 'ready-check') return; // Guard: only transition from ready-check
  await set(ref(db, `parties/${roomId}/currentTheme/startedAt`), serverTimestamp());
  await set(phaseRef, 'playing');
};

/**
 * Host moves to voting → everyone can now submit scores
 */
export const moveToVoting = async (roomId: string) => {
  const phaseRef = ref(db, `parties/${roomId}/phase`);
  const snap = await get(phaseRef);
  if (snap.val() !== 'playing') return; // Guard: only transition from playing
  await set(phaseRef, 'voting');
};

/**
 * Host triggers reveal
 */
export const triggerReveal = async (roomId: string) => {
  const phaseRef = ref(db, `parties/${roomId}/phase`);
  const snap = await get(phaseRef);
  if (snap.val() !== 'voting') return; // Guard: only transition from voting
  await set(phaseRef, 'reveal');
};

/**
 * Host resets to waiting for next theme.
 * If queue has items, auto-pops the next one → ready-check.
 * Returns true if a queued theme was loaded.
 */
export const resetToWaiting = async (roomId: string, users: Record<string, PartyUser>): Promise<boolean> => {
  // Reset all user ready/score states
  for (const uid of Object.keys(users)) {
    await set(ref(db, `parties/${roomId}/users/${uid}/ready`), false);
    await set(ref(db, `parties/${roomId}/users/${uid}/score`), null);
  }

  // Check queue
  const queueRef = ref(db, `parties/${roomId}/themeQueue`);
  const snap = await get(queueRef);
  if (snap.exists()) {
    const queue: QueueItem[] = snap.val();
    if (queue.length > 0) {
      const next = queue.shift()!;
      await set(queueRef, queue.length > 0 ? queue : null);
      await set(ref(db, `parties/${roomId}/currentTheme`), {
        ...next,
        startedAt: null,
      });
      await set(ref(db, `parties/${roomId}/phase`), 'ready-check');
      return true;
    }
  }

  // No queue → go to waiting
  await set(ref(db, `parties/${roomId}/currentTheme`), null);
  await set(ref(db, `parties/${roomId}/phase`), 'waiting');
  return false;
};

/* ═══════════════════════════════════════════
   USER ACTIONS
   ═══════════════════════════════════════════ */

/**
 * User marks ready during ready-check
 */
export const setUserReady = async (roomId: string, userId: string, ready: boolean) => {
  await set(ref(db, `parties/${roomId}/users/${userId}/ready`), ready);
};

/**
 * User submits their scores (0-100 per category) during voting
 */
export const submitScore = async (roomId: string, userId: string, scores: ThemeScore) => {
  const m = Number(scores.music);
  const a = Number(scores.animation);
  if (isNaN(m) || isNaN(a)) throw new Error('Invalid scores');
  await set(ref(db, `parties/${roomId}/users/${userId}/score`), {
    music: Math.round(Math.max(0, Math.min(100, m))),
    animation: Math.round(Math.max(0, Math.min(100, a))),
  });
};

/* ═══════════════════════════════════════════
   CHAT
   ═══════════════════════════════════════════ */

const MAX_CHAT_LENGTH = 500;

const sanitizeText = (text: string): string => {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

export const sendChatMessage = async (
  roomId: string, userId: string, displayName: string, 
  text: string, type: 'message' | 'reaction' = 'message'
) => {
  const sanitized = sanitizeText(text.slice(0, MAX_CHAT_LENGTH));
  if (!sanitized.trim()) return;
  const chatRef = push(ref(db, `parties/${roomId}/chat`));
  await set(chatRef, { userId, displayName: sanitizeText(displayName), text: sanitized, timestamp: serverTimestamp(), type });
};

/**
 * Save scores to history during reveal
 */
export const saveToHistory = async (
  roomId: string, animeName: string, themeSlug: string, 
  scores: Record<string, { music: number; animation: number }>
) => {
  const historyRef = push(ref(db, `parties/${roomId}/playHistory`));
  await set(historyRef, { animeName, themeSlug, playedAt: serverTimestamp(), scores });
};
