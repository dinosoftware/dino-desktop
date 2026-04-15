import type { PlatformAPI, ServerConfig, PlayQueue } from './types';
import type { Track } from '@/api/types';
import { getArtistDisplay } from '@/lib/utils';

const SERVERS_KEY = 'dino_servers';
const LAST_SERVER_KEY = 'dino_last_server';
const QUEUE_KEY = 'dino_queue';

export class WebPlatform implements PlatformAPI {
  isDesktop = false;
  private audio: HTMLAudioElement;
  private audioCtx: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private positionCallbacks: Set<(pos: number) => void> = new Set();
  private durationCallbacks: Set<(dur: number) => void> = new Set();
  private trackEndCallbacks: Set<() => void> = new Set();
  private trackErrorCallbacks: Set<(error: string) => void> = new Set();
  private playStateCallbacks: Set<(playing: boolean) => void> = new Set();
  private bufferCallbacks: Set<(buffered: number) => void> = new Set();
  private nextCallbacks: Set<() => void> = new Set();
  private prevCallbacks: Set<() => void> = new Set();
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

  async getServers(): Promise<ServerConfig[]> {
    const data = localStorage.getItem(SERVERS_KEY);
    return data ? JSON.parse(data) : [];
  }

  async saveServers(servers: ServerConfig[]): Promise<void> {
    localStorage.setItem(SERVERS_KEY, JSON.stringify(servers));
  }

  async getLastServerId(): Promise<string | null> {
    return localStorage.getItem(LAST_SERVER_KEY);
  }

  async setLastServerId(id: string): Promise<void> {
    localStorage.setItem(LAST_SERVER_KEY, id);
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
      this.analyserNode = analyser;
      this.audio.addEventListener('volumechange', () => { gain.gain.value = this.audio.volume; });
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
      if (e instanceof DOMException && e.name === 'AbortError' && !this.audio.paused) {
        return;
      }
      console.warn('play failed:', e);
      throw e;
    }
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

  async pause(): Promise<void> {
    try { await this.pendingPlay; } catch { /* already rejected is fine */ }
    this.audio.pause();
  }

  async resume(): Promise<void> {
    await this.initAudioPipeline();
    try {
      this.pendingPlay = this.audio.play();
      await this.pendingPlay;
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError' && !this.audio.paused) {
        return;
      }
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

  async saveQueue(queue: PlayQueue): Promise<void> {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }

  async loadQueue(): Promise<PlayQueue | null> {
    const data = localStorage.getItem(QUEUE_KEY);
    return data ? JSON.parse(data) : null;
  }

  async showOpenDialog(): Promise<string | null> {
    return null;
  }

  async showSaveDialog(): Promise<string | null> {
    return null;
  }

  async openExternal(url: string): Promise<void> {
    window.open(url, '_blank');
  }

  getAudioElement(): HTMLAudioElement | null {
    return this.audio;
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyserNode;
  }
}

export const webPlatform = new WebPlatform();
