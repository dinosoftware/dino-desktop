import { create } from 'zustand';
import type { Track } from '@/api/types';
import { usePlatform } from '@/platform';
import { apiClient } from '@/api/client';
import { getArtistDisplay } from '@/lib/utils';

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  position: number;
  duration: number;
  volume: number;
  repeat: 'off' | 'all' | 'one';
  shuffle: boolean;
  isLoading: boolean;
  originalQueue: Track[];
  buffered: number;

  play: (track: Track) => Promise<void>;
  playQueue: (tracks: Track[], startIndex?: number) => void;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  next: () => void;
  previous: () => void;
  seek: (position: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  addToQueue: (tracks: Track[]) => void;
  addNext: (tracks: Track[]) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  setPosition: (position: number) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  handleTrackError: (error: string) => void;
  loadQueueFromServer: () => Promise<void>;
  setBuffered: (buffered: number) => void;
}

let platformInstance: ReturnType<typeof usePlatform> | null = null;

const getPlatform = () => {
  if (!platformInstance) {
    throw new Error('Platform not initialized');
  }
  return platformInstance;
};

export const initializePlayerStore = (platform: ReturnType<typeof usePlatform>) => {
  platformInstance = platform;
};

let retryCount = 0;
const MAX_RETRIES = 3;
const AUTO_EXTEND_THRESHOLD = 3;
let scrobbleTrackId: string | null = null;
let scrobbleSubmitted = false;
let wakeLockRef: WakeLockSentinel | null = null;

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    if (wakeLockRef) return;
    wakeLockRef = await navigator.wakeLock.request('screen');
    wakeLockRef.addEventListener('release', () => { wakeLockRef = null; });
  } catch {}
}

async function releaseWakeLock() {
  if (wakeLockRef) {
    await wakeLockRef.release().catch(() => {});
    wakeLockRef = null;
  }
}

async function updateWakeLock(isPlaying: boolean) {
  const enabled = getRpcSetting('dino_wake_lock', false);
  if (!enabled) { await releaseWakeLock(); return; }
  if (isPlaying) { await requestWakeLock(); }
  else { await releaseWakeLock(); }
}

function checkScrobbleThreshold(position: number, duration: number) {
  if (!scrobbleTrackId || scrobbleSubmitted) return;
  const enabled = getRpcSetting('dino_scrobble', true);
  if (!enabled) return;
  if (duration <= 0) return;
  const threshold = Math.min(duration / 2, 240);
  if (position >= threshold) {
    scrobbleSubmitted = true;
    apiClient.scrobble(scrobbleTrackId, true).catch(() => {});
  }
}

function submitScrobble() {
  if (!scrobbleTrackId || scrobbleSubmitted) return;
  const enabled = getRpcSetting('dino_scrobble', true);
  if (!enabled) return;
  scrobbleSubmitted = true;
  apiClient.scrobble(scrobbleTrackId, true).catch(() => {});
}

async function autoExtendQueue() {
  const state = usePlayerStore.getState();
  const { queue, queueIndex, currentTrack } = state;
  if (!currentTrack) return;
  const remaining = queue.length - queueIndex - 1;
  if (remaining >= AUTO_EXTEND_THRESHOLD) return;

  try {
    const similar = await apiClient.getSimilarSongs(currentTrack.id, 10);
    if (similar.length === 0) return;
    const existingIds = new Set(queue.map((t: Track) => t.id));
    const newTracks = similar.filter((t: Track) => !existingIds.has(t.id));
    if (newTracks.length === 0) return;
    usePlayerStore.setState((state) => ({
      queue: [...state.queue, ...newTracks],
      originalQueue: [...state.originalQueue, ...newTracks],
    }));
    saveQueueToServer();
  } catch {
    // silent
  }
}

function loadPersistedState() {
  let volume = 1;
  let repeat: 'off' | 'all' | 'one' = 'off';
  let shuffle = false;
  try {
    const v = localStorage.getItem('dino_volume');
    if (v) volume = JSON.parse(v);
    const r = localStorage.getItem('dino_repeat');
    if (r) repeat = JSON.parse(r);
    const s = localStorage.getItem('dino_shuffle');
    if (s) shuffle = JSON.parse(s);
  } catch { /* ignore */ }
  return { volume, repeat, shuffle };
}

function persistVolume(v: number) {
  try { localStorage.setItem('dino_volume', JSON.stringify(v)); } catch { /* */ }
}
function persistRepeat(r: string) {
  try { localStorage.setItem('dino_repeat', JSON.stringify(r)); } catch { /* */ }
}
function persistShuffle(s: boolean) {
  try { localStorage.setItem('dino_shuffle', JSON.stringify(s)); } catch { /* */ }
}

function getRpcSetting(key: string, fallback: unknown): unknown {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}

const albumImageUrlCache = new Map<string, string>();

function prefetchAlbumImageUrl(albumId: string | undefined) {
  if (!albumId || albumImageUrlCache.has(albumId)) return;
  albumImageUrlCache.set(albumId, '');
  apiClient.getAlbumInfo2(albumId).then((info) => {
    const url = info?.largeImageUrl || '';
    albumImageUrlCache.set(albumId, url);
    if (url) {
      const { currentTrack, isPlaying } = usePlayerStore.getState();
      if (currentTrack?.albumId === albumId) {
        updateDiscordPresence(currentTrack, isPlaying);
      }
    }
  }).catch(() => {});
}

function updateDiscordPresence(track: Track | null, playing: boolean) {
  if (!platformInstance || !platformInstance.updateDiscordPresence) return;
  const enabled = getRpcSetting('dino_discord_rpc', false);
  if (!enabled) { platformInstance.clearDiscordPresence?.().catch(() => {}); return; }

  if (!playing) {
    const showPaused = getRpcSetting('dino_discord_rpc_paused', false);
    if (!showPaused) {
      platformInstance.clearDiscordPresence?.().catch(() => {});
      return;
    }
  }

  if (!track) { platformInstance.clearDiscordPresence?.().catch(() => {}); return; }

  const clientId = getRpcSetting('dino_discord_rpc_client_id', '797506661857099858') as string;
  const activityType = getRpcSetting('dino_discord_rpc_activity_type', 2) as number;
  const displayType = getRpcSetting('dino_discord_rpc_display', 0) as number;
  const showTime = getRpcSetting('dino_discord_rpc_show_time', true) as boolean;

  const artistText = getArtistDisplay(track).text;
  let details = '';
  let state = '';
  switch (displayType) {
    case 0:
      details = 'Dino Desktop';
      state = `${track.title || ''} — ${artistText || ''}`;
      break;
    case 1:
      details = artistText || '';
      state = track.title || '';
      break;
    default:
      details = track.title || '';
      state = artistText || '';
  }
  if (!playing) state = `${state} — Paused`;

  const storeState = usePlayerStore.getState();
  const startMs = showTime && playing ? Date.now() - (storeState.position * 1000) : 0;
  const endMs = showTime && playing && storeState.duration > 0 ? Date.now() + ((storeState.duration - storeState.position) * 1000) : 0;
  const serverUrl = apiClient.getServerUrl() || '';
  const coverUrl = track.albumId ? (albumImageUrlCache.get(track.albumId) || 'dino') : 'dino';

  platformInstance.updateDiscordPresence({
    enabled: true,
    clientId,
    activityType,
    details,
    state,
    largeImage: coverUrl,
    largeText: track.album || '',
    smallImage: '',
    smallText: playing ? 'Playing' : 'Paused',
    showTimestamps: showTime && playing,
    startMs,
    endMs,
    showButtons: !!serverUrl,
    buttonLabel: 'Listen',
    buttonUrl: serverUrl,
  }).catch((err) => { console.warn('discord rpc error:', err); });

  if (track.albumId && !albumImageUrlCache.has(track.albumId)) {
    prefetchAlbumImageUrl(track.albumId);
  }
}

function saveQueueToServer() {
  if (!apiClient.hasCredentials()) return;
  const { queue, currentTrack, position } = usePlayerStore.getState();
  if (queue.length === 0) return;
  const ids = queue.map(t => t.id);
  apiClient.savePlayQueue(ids, currentTrack?.id, Math.floor(position * 1000)).catch(() => {});
}

export function refreshDiscordPresence() {
  const { currentTrack, isPlaying } = usePlayerStore.getState();
  updateDiscordPresence(currentTrack, isPlaying);
}

export function connectDiscordRPC() {
  if (!platformInstance?.connectDiscord) return;
  const enabled = getRpcSetting('dino_discord_rpc', false);
  if (!enabled) return;
  const clientId = getRpcSetting('dino_discord_rpc_client_id', '797506661857099858') as string;
  platformInstance.connectDiscord(clientId).catch(() => {});
}

export function clearDiscordRPC() {
  if (platformInstance?.clearDiscordPresence) {
    platformInstance.clearDiscordPresence().catch(() => {});
  }
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  queueIndex: -1,
  isPlaying: false,
  position: 0,
  duration: 0,
  volume: loadPersistedState().volume,
  repeat: loadPersistedState().repeat,
  shuffle: loadPersistedState().shuffle,
  isLoading: false,
  originalQueue: [],
  buffered: 0,

  play: async (track) => {
    const platform = getPlatform();
    retryCount = 0;
    set({ isLoading: true, currentTrack: track, position: 0, duration: 0, buffered: 0 });

    updateDiscordPresence(track, true);
    prefetchAlbumImageUrl(track.albumId);

    scrobbleTrackId = track.id;
    scrobbleSubmitted = false;

    try {
      const url = apiClient.buildStreamUrl(track.id);
      const coverUrl = track.coverArt ? apiClient.buildCoverArtUrl(track.coverArt, 512) : undefined;
      await platform.play(track, url);
      platform.setMediaMetadata(track, coverUrl).catch(() => {});

      if (getRpcSetting('dino_scrobble', true)) {
        apiClient.scrobble(track.id, false).catch(() => {});
      }

      const { queue, queueIndex } = get();
      if (queueIndex === -1 || queue[queueIndex]?.id !== track.id) {
        const idx = queue.findIndex(t => t.id === track.id);
        if (idx >= 0) {
          set({ queueIndex: idx });
        }
      }

       autoExtendQueue();
      saveQueueToServer();
    } catch (e) {
      console.warn('play error:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  playQueue: (tracks, startIndex = 0) => {
    if (tracks.length === 0) return;

    const { shuffle } = get();
    if (shuffle) {
      const selectedTrack = tracks[startIndex];
      const rest = [...tracks.slice(0, startIndex), ...tracks.slice(startIndex + 1)];
      const shuffledRest = shuffleArray(rest);
      const queue = [selectedTrack, ...shuffledRest];
      set({ queue, originalQueue: [...tracks], queueIndex: 0 });
      get().play(selectedTrack);
    } else {
      set({ queue: [...tracks], originalQueue: [...tracks], queueIndex: startIndex });
      get().play(tracks[startIndex]);
    }
    saveQueueToServer();
  },

  pause: async () => {
    updateDiscordPresence(get().currentTrack, false);
    await getPlatform().pause();
    saveQueueToServer();
  },

  resume: async () => {
    const platform = getPlatform();
    const { currentTrack, position } = get();
    if (!currentTrack) return;

    try {
      const audio = platform.getAudioElement();
      if (audio && audio.src && audio.readyState >= 2) {
        await platform.resume();
      } else {
        const url = apiClient.buildStreamUrl(currentTrack.id);
        await platform.play(currentTrack, url);
        if (position > 0) await platform.seek(position);
      }
    } catch {
      return;
    }
    updateDiscordPresence(currentTrack, true);
    saveQueueToServer();
  },

  stop: async () => {
    const platform = getPlatform();
    await platform.stop();
    set({ isPlaying: false, position: 0, currentTrack: null });
    if (platformInstance?.clearDiscordPresence) platformInstance.clearDiscordPresence().catch(() => {});
  },

  next: () => {
    const { queue, queueIndex, repeat, currentTrack } = get();

    submitScrobble();

    if (repeat === 'one' && currentTrack) {
      set({ position: 0 });
      get().seek(0).then(() => get().resume());
      return;
    }

    let nextIndex = queueIndex + 1;

    if (nextIndex >= queue.length) {
      if (repeat === 'all' && queue.length > 0) {
        nextIndex = 0;
      } else {
        set({ isPlaying: false });
        return;
      }
    }

    const track = queue[nextIndex];
    if (track) {
      set({ queueIndex: nextIndex });
      get().play(track);
    }
  },

  previous: () => {
    const { queue, queueIndex, position } = get();

    if (position > 3) {
      get().seek(0);
      return;
    }

    const prevIndex = queueIndex - 1;
    if (prevIndex >= 0) {
      const track = queue[prevIndex];
      if (track) {
        set({ queueIndex: prevIndex });
        get().play(track);
      }
    } else if (queue.length > 0) {
      get().seek(0);
    }
  },

  seek: async (position) => {
    const platform = getPlatform();
    await platform.seek(position);
    set({ position });
    saveQueueToServer();
  },

  setVolume: async (volume) => {
    const platform = getPlatform();
    await platform.setVolume(volume);
    set({ volume });
    persistVolume(volume);
  },

  toggleRepeat: () => {
    const { repeat } = get();
    const modes: ('off' | 'all' | 'one')[] = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf(repeat);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    set({ repeat: nextMode });
    persistRepeat(nextMode);
  },

  toggleShuffle: () => {
    const { shuffle, queue, queueIndex, originalQueue } = get();
    if (!shuffle) {
      const currentTrack = queue[queueIndex];
      const beforeCurrent = queue.slice(0, queueIndex);
      const afterCurrent = queue.slice(queueIndex + 1);
      const shuffledRest = shuffleArray([...beforeCurrent, ...afterCurrent]);
      const newQueue = currentTrack ? [currentTrack, ...shuffledRest] : shuffledRest;
      set({ shuffle: true, queue: newQueue, queueIndex: 0 });
      persistShuffle(true);
      saveQueueToServer();
    } else {
      const currentTrack = queue[queueIndex];
      const originalIndex = originalQueue.length > 0
        ? originalQueue.findIndex(t => t.id === currentTrack?.id)
        : queueIndex;
      set({
        shuffle: false,
        queue: originalQueue.length > 0 ? [...originalQueue] : [...queue],
        queueIndex: originalIndex >= 0 ? originalIndex : 0,
      });
      persistShuffle(false);
      saveQueueToServer();
    }
  },

  addToQueue: (tracks) => {
    set((state) => ({
      queue: [...state.queue, ...tracks],
      originalQueue: [...state.originalQueue, ...tracks],
    }));
    saveQueueToServer();
  },

  addNext: (tracks) => {
    set((state) => {
      const insertAt = state.queueIndex + 1;
      const newQueue = [...state.queue];
      newQueue.splice(insertAt, 0, ...tracks);
      const newOriginal = [...state.originalQueue];
      newOriginal.splice(
        state.originalQueue.findIndex(t => t.id === state.queue[state.queueIndex]?.id) + 1,
        0,
        ...tracks
      );
      return { queue: newQueue, originalQueue: newOriginal };
    });
    saveQueueToServer();
  },

  removeFromQueue: (index) => {
    set((state) => {
      const queue = [...state.queue];
      queue.splice(index, 1);
      let queueIndex = state.queueIndex;
      if (index < queueIndex) {
        queueIndex--;
      } else if (index === queueIndex) {
        if (queue.length > 0) {
          const nextTrack = queue[Math.min(queueIndex, queue.length - 1)];
          get().play(nextTrack);
          queueIndex = Math.min(queueIndex, queue.length - 1);
        } else {
          queueIndex = -1;
        }
      }
      return { queue, queueIndex };
    });
    saveQueueToServer();
  },

  clearQueue: () => {
    set({ queue: [], originalQueue: [], queueIndex: -1, currentTrack: null, isPlaying: false });
    saveQueueToServer();
  },

  setPosition: (position) => {
    const { duration } = get();
    checkScrobbleThreshold(position, duration);
    set({ position });
  },
  setDuration: (duration) => set({ duration }),
  setIsPlaying: (isPlaying) => {
    set({ isPlaying });
    updateDiscordPresence(get().currentTrack, isPlaying);
    updateWakeLock(isPlaying);
  },

  handleTrackError: (_error?: string) => {
    const { currentTrack, queue, queueIndex } = get();
    if (!currentTrack) return;

    if (retryCount < MAX_RETRIES) {
      retryCount++;
      const url = apiClient.buildStreamUrl(currentTrack.id);
      const platform = getPlatform();
      platform.play(currentTrack, url).catch(() => {});
      return;
    }

    retryCount = 0;
    let nextIndex = queueIndex + 1;
    if (nextIndex >= queue.length) {
      nextIndex = 0;
    }
    if (queue[nextIndex] && nextIndex !== queueIndex) {
      set({ queueIndex: nextIndex });
      get().play(queue[nextIndex]);
    } else {
      set({ isPlaying: false });
    }
  },

  loadQueueFromServer: async () => {
    try {
      const { entries, currentId, position } = await apiClient.getPlayQueue();
      if (entries.length > 0) {
        const idx = currentId ? entries.findIndex(t => t.id === currentId) : 0;
        const queueIndex = idx >= 0 ? idx : 0;
        const currentTrack = entries[queueIndex] || null;
        const posSeconds = position ? position / 1000 : 0;
        set({
          queue: entries,
          originalQueue: [...entries],
          queueIndex,
          currentTrack,
          position: posSeconds,
          isPlaying: false,
        });

        if (currentTrack) {
          const platform = getPlatform();
          const url = apiClient.buildStreamUrl(currentTrack.id);
          const coverUrl = currentTrack.coverArt ? apiClient.buildCoverArtUrl(currentTrack.coverArt, 512) : undefined;
          try {
            await platform.play(currentTrack, url);
            await platform.seek(posSeconds);
            await platform.pause();
            set({ isPlaying: false });
          } catch {
            set({ isPlaying: false });
          }
          platform.setMediaMetadata(currentTrack, coverUrl).catch(() => {});
        }
      }
    } catch {
      // silent
    }
  },

  setBuffered: (buffered) => set({ buffered }),
}));

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
