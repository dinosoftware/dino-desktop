import type { Track } from '@/api/types';

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseName: string;
  releaseNotes: string | Array<{ version: string; note: string }>;
}

export interface UpdateCheckResult {
  available: boolean;
  info: UpdateInfo | null;
  error?: string;
}

export interface DownloadProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

export interface PlayQueue {
  current?: string;
  position?: number;
  username?: string;
  changed?: string;
  entry?: Track[];
}

export interface ServerConfig {
  id: string;
  name: string;
  url: string;
  username: string;
  token: string;
  salt: string;
  isDefault?: boolean;
}

export interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  position: number;
  duration: number;
  volume: number;
  repeat: 'off' | 'all' | 'one';
  shuffle: boolean;
}

export interface PlatformAPI {
  isDesktop: boolean;

  // Storage
  getServers(): Promise<ServerConfig[]>;
  saveServers(servers: ServerConfig[]): Promise<void>;
  getLastServerId(): Promise<string | null>;
  setLastServerId(id: string): Promise<void>;

  // Player
  play(track: Track, url: string): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  seek(position: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
  preload?(url: string): void;
  getPosition(): Promise<number>;
  getDuration(): Promise<number>;
  onPositionChange(callback: (position: number) => void): () => void;
  onDurationChange(callback: (duration: number) => void): () => void;
  onTrackEnd(callback: () => void): () => void;
  onTrackError(callback: (error: string) => void): () => void;
  onPlayStateChange(callback: (isPlaying: boolean) => void): () => void;
  onBufferChange(callback: (buffered: number) => void): () => void;
  onBufferingChange?(callback: (isBuffering: boolean) => void): () => void;
  onNext(callback: () => void): () => void;
  onPrevious(callback: () => void): () => void;

  // Queue persistence
  saveQueue(queue: PlayQueue): Promise<void>;
  loadQueue(): Promise<PlayQueue | null>;

  // System
  showOpenDialog(options: {
    title?: string;
    defaultPath?: string;
    filters?: { name: string; extensions: string[] }[];
  }): Promise<string | null>;
  showSaveDialog(options: {
    title?: string;
    defaultPath?: string;
    filters?: { name: string; extensions: string[] }[];
  }): Promise<string | null>;
  openExternal(url: string): Promise<void>;

  setMediaMetadata(track: Track, artworkUrl?: string): Promise<void>;

  getAudioElement(): HTMLAudioElement | null;
  getAnalyser(): AnalyserNode | null;

  updateDiscordPresence?(args: {
    enabled: boolean;
    clientId: string;
    activityType: number;
    details: string;
    state: string;
    statusDisplayType: number;
    largeImage: string;
    largeText: string;
    smallImage: string;
    smallText: string;
    showTimestamps: boolean;
    startMs: number;
    endMs: number;
    showButtons: boolean;
    buttonLabel: string;
    buttonUrl: string;
  }): Promise<void>;
  clearDiscordPresence?(): Promise<void>;
  connectDiscord?(clientId: string): Promise<void>;

  // Window (desktop only)
  minimizeWindow?(): void;
  maximizeWindow?(): void;
  closeWindow?(): void;
  isWindowMaximized?(): Promise<boolean>;
  writeClipboard?(text: string): Promise<void>;

  // Auto-updater (desktop only)
  checkForUpdate?(): Promise<UpdateCheckResult>;
  downloadUpdate?(): Promise<void>;
  installUpdate?(): void;
  getUpdateProgress?(): Promise<DownloadProgress | null>;
  canAutoUpdate?(): Promise<boolean>;
  getAppVersion?(): Promise<string>;
  onUpdateDownloadProgress?(callback: (progress: DownloadProgress) => void): () => void;
  onUpdateDownloaded?(callback: () => void): () => void;
  onUpdateError?(callback: (error: string) => void): () => void;

  // mpv backend (desktop only)
  detectMpv?(): Promise<boolean>;
  enableMpv?(): Promise<boolean>;
  disableMpv?(): void;
  isMpvEnabled?(): boolean;
  mpvNext?(): Promise<void>;
  consumeMpvAutoAdvanced?(): boolean;

  // App control (desktop only)
  relaunchApp?(): Promise<void>;
}
