import type { PlatformAPI, ServerConfig, PlayQueue } from './types';
import type { Track } from '@/api/types';
import { getArtistDisplay } from '@/lib/utils';

type PlayStateCallback = (playing: boolean) => void;
type PositionCallback = (position: number) => void;
type DurationCallback = (duration: number) => void;
type TrackEndCallback = () => void;
type TrackErrorCallback = (error: string) => void;
type NextPrevCallback = () => void;

declare global {
  interface Window {
    go: {
      main: {
        App: {
          GetServers(): Promise<string>;
          SaveServers(servers: string): Promise<void>;
          GetLastServerId(): Promise<string>;
          SetLastServerId(id: string): Promise<void>;
          SaveQueue(queue: string): Promise<void>;
          LoadQueue(): Promise<string>;
          ShowOpenDialog(title: string, defaultPath: string, filters: string): Promise<string>;
          ShowSaveDialog(title: string, defaultPath: string, filters: string): Promise<string>;
          OpenExternal(url: string): Promise<void>;
          MinimizeWindow(): Promise<void>;
          MaximizeWindow(): Promise<void>;
          CloseWindow(): Promise<void>;
          IsWindowMaximized(): Promise<boolean>;
          UpdateDiscordPresence(jsonArgs: string): Promise<void>;
          ClearDiscordPresence(): Promise<void>;
          ConnectDiscord(clientId: string): Promise<void>;
        };
      };
    };
  }
}

export class WailsPlatform implements PlatformAPI {
  isDesktop = true;

  private audio: HTMLAudioElement;
  private positionCallbacks: Set<PositionCallback> = new Set();
  private durationCallbacks: Set<DurationCallback> = new Set();
  private trackEndCallbacks: Set<TrackEndCallback> = new Set();
  private trackErrorCallbacks: Set<TrackErrorCallback> = new Set();
  private playStateCallbacks: Set<PlayStateCallback> = new Set();
  private bufferCallbacks: Set<(buffered: number) => void> = new Set();
  private nextCallbacks: Set<NextPrevCallback> = new Set();
  private prevCallbacks: Set<NextPrevCallback> = new Set();

  constructor() {
    this.audio = new Audio();
    this.audio.crossOrigin = 'anonymous';
    this.audio.addEventListener('timeupdate', () => {
      this.positionCallbacks.forEach(cb => cb(this.audio.currentTime));
    });
    this.audio.addEventListener('durationchange', () => {
      this.durationCallbacks.forEach(cb => cb(this.audio.duration));
    });
    this.audio.addEventListener('ended', () => {
      this.trackEndCallbacks.forEach(cb => cb());
    });
    this.audio.addEventListener('error', () => {
      const err = this.audio.error?.message || 'playback error';
      this.trackErrorCallbacks.forEach(cb => cb(err));
    });
    this.audio.addEventListener('play', () => {
      this.playStateCallbacks.forEach(cb => cb(true));
    });
    this.audio.addEventListener('pause', () => {
      if (this.audio.ended) return;
      this.playStateCallbacks.forEach(cb => cb(false));
    });
    this.audio.addEventListener('progress', () => {
      if (this.audio.buffered.length > 0) {
        this.bufferCallbacks.forEach(cb => cb(this.audio.buffered.end(this.audio.buffered.length - 1)));
      }
    });

    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => {
        this.audio.play();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        this.audio.pause();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        this.nextCallbacks.forEach(cb => cb());
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        this.prevCallbacks.forEach(cb => cb());
      });
    }
  }

  async play(_track: Track, url: string): Promise<void> {
    this.audio.src = url;
    try {
      await Promise.race([
        this.audio.play(),
        new Promise<void>((_, reject) => setTimeout(() => reject(new Error('playback timeout')), 15000)),
      ]);
    } catch (e) {
      console.warn('play failed:', e);
      throw e;
    }
  }

  async pause(): Promise<void> {
    this.audio.pause();
  }

  async resume(): Promise<void> {
    await this.audio.play();
  }

  async stop(): Promise<void> {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.audio.src = '';
  }

  async seek(position: number): Promise<void> {
    this.audio.currentTime = position;
  }

  async setVolume(volume: number): Promise<void> {
    this.audio.volume = volume;
  }

  async getPosition(): Promise<number> {
    return this.audio.currentTime;
  }

  async getDuration(): Promise<number> {
    return this.audio.duration || 0;
  }

  async setMediaMetadata(track: Track, artworkUrl?: string): Promise<void> {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title || 'Unknown',
      artist: getArtistDisplay(track).text || 'Unknown Artist',
      album: track.album || 'Unknown Album',
      artwork: artworkUrl ? [{ src: artworkUrl, sizes: '512x512', type: 'image/jpeg' }] : [],
    });
  }

  onPositionChange(callback: (position: number) => void): () => void {
    this.positionCallbacks.add(callback);
    return () => this.positionCallbacks.delete(callback);
  }

  onDurationChange(callback: (duration: number) => void): () => void {
    this.durationCallbacks.add(callback);
    return () => this.durationCallbacks.delete(callback);
  }

  onTrackEnd(callback: () => void): () => void {
    this.trackEndCallbacks.add(callback);
    return () => this.trackEndCallbacks.delete(callback);
  }

  onTrackError(callback: (error: string) => void): () => void {
    this.trackErrorCallbacks.add(callback);
    return () => this.trackErrorCallbacks.delete(callback);
  }

  onPlayStateChange(callback: (isPlaying: boolean) => void): () => void {
    this.playStateCallbacks.add(callback);
    return () => this.playStateCallbacks.delete(callback);
  }

  onBufferChange(callback: (buffered: number) => void): () => void {
    this.bufferCallbacks.add(callback);
    return () => this.bufferCallbacks.delete(callback);
  }

  onNext(callback: () => void): () => void {
    this.nextCallbacks.add(callback);
    return () => this.nextCallbacks.delete(callback);
  }

  onPrevious(callback: () => void): () => void {
    this.prevCallbacks.add(callback);
    return () => this.prevCallbacks.delete(callback);
  }

  async getServers(): Promise<ServerConfig[]> {
    const data = await window.go.main.App.GetServers();
    return data ? JSON.parse(data) : [];
  }

  async saveServers(servers: ServerConfig[]): Promise<void> {
    await window.go.main.App.SaveServers(JSON.stringify(servers));
  }

  async getLastServerId(): Promise<string | null> {
    const id = await window.go.main.App.GetLastServerId();
    return id || null;
  }

  async setLastServerId(id: string): Promise<void> {
    await window.go.main.App.SetLastServerId(id);
  }

  async saveQueue(queue: PlayQueue): Promise<void> {
    await window.go.main.App.SaveQueue(JSON.stringify(queue));
  }

  async loadQueue(): Promise<PlayQueue | null> {
    const data = await window.go.main.App.LoadQueue();
    return data ? JSON.parse(data) : null;
  }

  async showOpenDialog(options: {
    title?: string;
    defaultPath?: string;
    filters?: { name: string; extensions: string[] }[];
  }): Promise<string | null> {
    const result = await window.go.main.App.ShowOpenDialog(
      options.title || '',
      options.defaultPath || '',
      JSON.stringify(options.filters || [])
    );
    return result || null;
  }

  async showSaveDialog(options: {
    title?: string;
    defaultPath?: string;
    filters?: { name: string; extensions: string[] }[];
  }): Promise<string | null> {
    const result = await window.go.main.App.ShowSaveDialog(
      options.title || '',
      options.defaultPath || '',
      JSON.stringify(options.filters || [])
    );
    return result || null;
  }

  async openExternal(url: string): Promise<void> {
    await window.go.main.App.OpenExternal(url);
  }

  minimizeWindow(): void {
    window.go.main.App.MinimizeWindow();
  }

  maximizeWindow(): void {
    window.go.main.App.MaximizeWindow();
  }

  closeWindow(): void {
    window.go.main.App.CloseWindow();
  }

  async isWindowMaximized(): Promise<boolean> {
    return await window.go.main.App.IsWindowMaximized();
  }

  async updateDiscordPresence(args: {
    enabled: boolean;
    clientId: string;
    activityType: number;
    details: string;
    state: string;
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
    statusDisplayType: number;
  }): Promise<void> {
    await window.go.main.App.UpdateDiscordPresence(JSON.stringify(args));
  }

  async clearDiscordPresence(): Promise<void> {
    await window.go.main.App.ClearDiscordPresence();
  }

  async connectDiscord(clientId: string): Promise<void> {
    await window.go.main.App.ConnectDiscord(clientId);
  }

  getAudioElement(): HTMLAudioElement | null {
    return this.audio;
  }
}
