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
    electronAPI: {
      getServers(): Promise<string>;
      saveServers(json: string): Promise<void>;
      getLastServerId(): Promise<string>;
      setLastServerId(id: string): Promise<void>;
      saveQueue(json: string): Promise<void>;
      loadQueue(): Promise<string>;
      showOpenDialog(opts: { title: string; defaultPath: string }): Promise<string>;
      showSaveDialog(opts: { title: string; defaultPath: string }): Promise<string>;
      openExternal(url: string): Promise<void>;
      discordConnect(clientId: string): Promise<void>;
      discordUpdatePresence(args: Record<string, unknown>): Promise<void>;
      discordClearPresence(): Promise<void>;
      minimizeWindow(): Promise<void>;
      maximizeWindow(): Promise<void>;
      closeWindow(): Promise<void>;
      isWindowMaximized(): Promise<boolean>;
    };
  }
}

export class ElectronPlatform implements PlatformAPI {
  isDesktop = true;
  private audio: HTMLAudioElement;
  private audioCtx: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private positionCallbacks: Set<PositionCallback> = new Set();
  private durationCallbacks: Set<DurationCallback> = new Set();
  private trackEndCallbacks: Set<TrackEndCallback> = new Set();
  private trackErrorCallbacks: Set<TrackErrorCallback> = new Set();
  private playStateCallbacks: Set<PlayStateCallback> = new Set();
  private bufferCallbacks: Set<(buffered: number) => void> = new Set();
  private nextCallbacks: Set<NextPrevCallback> = new Set();
  private prevCallbacks: Set<NextPrevCallback> = new Set();
  private pendingPlay: Promise<void> = Promise.resolve();

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

  private async initAudioPipeline() {
    if (this.audioCtx) {
      if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();
      return;
    }
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaElementSource(this.audio);
      const gain = ctx.createGain();
      gain.gain.value = this.audio.volume;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(gain);
      gain.connect(analyser);
      analyser.connect(ctx.destination);
      ctx.onstatechange = () => {
        if (ctx.state === 'suspended' && !this.audio.paused) ctx.resume();
      };
      this.audioCtx = ctx;
      this.gainNode = gain;
      this.analyserNode = analyser;
      this.audio.addEventListener('volumechange', () => {
        if (this.gainNode) this.gainNode.gain.value = this.audio.volume;
      });
    } catch { /* already created */ }
  }

  async play(_track: Track, url: string): Promise<void> {
    this.audio.src = url;
    this.audio.load();
    await this.initAudioPipeline();
    try {
      this.pendingPlay = this.audio.play();
      await Promise.race([
        this.pendingPlay,
        new Promise<void>((_, reject) => setTimeout(() => reject(new Error('playback timeout')), 15000)),
      ]);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError' && !this.audio.paused) return;
      console.warn('play failed:', e);
      throw e;
    }
  }

  async pause(): Promise<void> {
    try { await this.pendingPlay; } catch { /* already rejected */ }
    this.audio.pause();
  }

  async resume(): Promise<void> {
    await this.initAudioPipeline();
    try {
      this.pendingPlay = this.audio.play();
      await this.pendingPlay;
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError' && !this.audio.paused) return;
      throw e;
    }
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
    const data = await window.electronAPI.getServers();
    return data ? JSON.parse(data) : [];
  }

  async saveServers(servers: ServerConfig[]): Promise<void> {
    await window.electronAPI.saveServers(JSON.stringify(servers));
  }

  async getLastServerId(): Promise<string | null> {
    const id = await window.electronAPI.getLastServerId();
    return id || null;
  }

  async setLastServerId(id: string): Promise<void> {
    await window.electronAPI.setLastServerId(id);
  }

  async saveQueue(queue: PlayQueue): Promise<void> {
    await window.electronAPI.saveQueue(JSON.stringify(queue));
  }

  async loadQueue(): Promise<PlayQueue | null> {
    const data = await window.electronAPI.loadQueue();
    return data ? JSON.parse(data) : null;
  }

  async showOpenDialog(options: {
    title?: string;
    defaultPath?: string;
    filters?: { name: string; extensions: string[] }[];
  }): Promise<string | null> {
    const result = await window.electronAPI.showOpenDialog({
      title: options.title || '',
      defaultPath: options.defaultPath || '',
    });
    return result || null;
  }

  async showSaveDialog(options: {
    title?: string;
    defaultPath?: string;
    filters?: { name: string; extensions: string[] }[];
  }): Promise<string | null> {
    const result = await window.electronAPI.showSaveDialog({
      title: options.title || '',
      defaultPath: options.defaultPath || '',
    });
    return result || null;
  }

  async openExternal(url: string): Promise<void> {
    await window.electronAPI.openExternal(url);
  }

  minimizeWindow(): void {
    window.electronAPI.minimizeWindow();
  }

  maximizeWindow(): void {
    window.electronAPI.maximizeWindow();
  }

  closeWindow(): void {
    window.electronAPI.closeWindow();
  }

  async isWindowMaximized(): Promise<boolean> {
    return await window.electronAPI.isWindowMaximized();
  }

  async updateDiscordPresence(args: {
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
  }): Promise<void> {
    if (!args.enabled) {
      await this.clearDiscordPresence();
      return;
    }
    await window.electronAPI.discordUpdatePresence(args);
  }

  async clearDiscordPresence(): Promise<void> {
    await window.electronAPI.discordClearPresence();
  }

  async connectDiscord(clientId: string): Promise<void> {
    await window.electronAPI.discordConnect(clientId);
  }

  getAudioElement(): HTMLAudioElement | null {
    return this.audio;
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyserNode;
  }
}
