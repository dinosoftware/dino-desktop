import type { PlatformAPI, ServerConfig, PlayQueue, UpdateCheckResult, DownloadProgress } from './types';
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
      updaterCheck(): Promise<UpdateCheckResult>;
      updaterDownload(): Promise<void>;
      updaterInstall(): Promise<void>;
      updaterGetProgress(): Promise<DownloadProgress | null>;
      updaterCanAutoUpdate(): Promise<boolean>;
      getAppVersion(): Promise<string>;
      onUpdaterDownloadProgress(cb: (data: DownloadProgress) => void): () => void;
      onUpdaterDownloadComplete(cb: () => void): () => void;
      onUpdaterError(cb: (msg: string) => void): () => void;
      mpvDetect(): Promise<boolean>;
      mpvStart(): Promise<boolean>;
      mpvStop(): Promise<void>;
      mpvLoad(url: string, opts?: { append?: boolean; options?: Record<string, string> }): Promise<void>;
      mpvSetPause(v: boolean): Promise<void>;
      mpvSeek(v: number): Promise<void>;
      mpvSetVolume(v: number): Promise<void>;
      mpvGetTime(): Promise<number>;
      mpvGetDuration(): Promise<number>;
      mpvPlaylistNext(): Promise<void>;
      mpvStopPlayback(): Promise<void>;
      mpvPlaylistClear(): Promise<void>;
      relaunchApp(): Promise<void>;
      onMpvProperty(cb: (data: { name: string; data: unknown }) => void): () => void;
      onMpvEndFile(cb: (data: { reason: string }) => void): () => void;

      mprisUpdateMetadata(data: { id: string; title: string; artist: string; album: string; duration: number; artworkUrl: string }): void;
      mprisUpdatePlayback(status: string): void;
      mprisUpdatePosition(positionSec: number): void;
      mprisUpdateVolume(volume: number): void;
      mprisSeeked(positionSec: number): void;
      onMprisPlay(cb: () => void): () => void;
      onMprisPause(cb: () => void): () => void;
      onMprisPlayPause(cb: () => void): () => void;
      onMprisNext(cb: () => void): () => void;
      onMprisPrevious(cb: () => void): () => void;
      onMprisStop(cb: () => void): () => void;
      onMprisSeek(cb: (data: { offset: number }) => void): () => void;
      onMprisSetPosition(cb: (data: { position: number }) => void): () => void;
      onMprisVolume(cb: (data: { volume: number }) => void): () => void;
    };
  }
}

export class ElectronPlatform implements PlatformAPI {
  isDesktop = true;
  private audio: HTMLAudioElement;
  private preloadAudio: HTMLAudioElement | null = null;
  private preloadUrl: string | null = null;
  private audioCtx: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private currentSource: MediaElementAudioSourceNode | null = null;
  private useMpv = false;
  private mpvReady = false;
  private mpvPosition = 0;
  private mpvDuration = 0;
  private mpvPaused = true;
  private mpvPreloadedNext = false;
  private mpvAutoAdvanced = false;
  private mpvLastPreloadedUrl: string | null = null;
  private mpvInAutoAdvanceTransition = false;
  private mprisArtworkUrl: string | null = null;
  private mprisCurrentTrack: Track | null = null;
  private mpvPropertyUnsub: (() => void) | null = null;
  private mpvEndFileUnsub: (() => void) | null = null;
  private positionCallbacks: Set<PositionCallback> = new Set();
  private durationCallbacks: Set<DurationCallback> = new Set();
  private trackEndCallbacks: Set<TrackEndCallback> = new Set();
  private trackErrorCallbacks: Set<TrackErrorCallback> = new Set();
  private playStateCallbacks: Set<PlayStateCallback> = new Set();
  private bufferCallbacks: Set<(buffered: number) => void> = new Set();
  private bufferingCallbacks: Set<(isBuffering: boolean) => void> = new Set();
  private nextCallbacks: Set<NextPrevCallback> = new Set();
  private prevCallbacks: Set<NextPrevCallback> = new Set();
  private pendingPlay: Promise<void> = Promise.resolve();
  private boundTimeupdate: () => void;
  private boundDurationchange: () => void;
  private boundEnded: () => void;
  private boundError: () => void;
  private boundPlay: () => void;
  private boundPause: () => void;
  private boundProgress: () => void;
  private boundWaiting: () => void;
  private boundPlaying: () => void;

  constructor() {
    this.audio = new Audio();
    this.audio.crossOrigin = 'anonymous';

    this.boundTimeupdate = () => {
      if (this.useMpv) return;
      this.positionCallbacks.forEach(cb => cb(this.audio.currentTime));
      this.mprisSetPosition(this.audio.currentTime);
    };
    this.boundDurationchange = () => {
      if (this.useMpv) return;
      this.durationCallbacks.forEach(cb => cb(this.audio.duration));
    };
    this.boundEnded = () => {
      if (this.useMpv) return;
      this.trackEndCallbacks.forEach(cb => cb());
    };
    this.boundError = () => {
      if (this.useMpv) return;
      const err = this.audio.error?.message || 'playback error';
      this.trackErrorCallbacks.forEach(cb => cb(err));
    };
    this.boundPlay = () => {
      if (this.useMpv) return;
      this.playStateCallbacks.forEach(cb => cb(true));
      this.mprisSetPlayback('Playing');
    };
    this.boundPause = () => {
      if (this.useMpv) return;
      if (this.audio.ended) return;
      this.playStateCallbacks.forEach(cb => cb(false));
      this.mprisSetPlayback('Paused');
    };
    this.boundProgress = () => {
      if (this.useMpv) return;
      if (this.audio.buffered.length > 0) {
        this.bufferCallbacks.forEach(cb => cb(this.audio.buffered.end(this.audio.buffered.length - 1)));
      }
    };
    this.boundWaiting = () => {
      if (this.useMpv) return;
      this.bufferingCallbacks.forEach(cb => cb(true));
    };
    this.boundPlaying = () => {
      if (this.useMpv) return;
      this.bufferingCallbacks.forEach(cb => cb(false));
    };

    this.attachAudioEvents(this.audio);

    this.setupMprisListeners();
  }

  private attachAudioEvents(el: HTMLAudioElement) {
    el.addEventListener('timeupdate', this.boundTimeupdate);
    el.addEventListener('durationchange', this.boundDurationchange);
    el.addEventListener('ended', this.boundEnded);
    el.addEventListener('error', this.boundError);
    el.addEventListener('play', this.boundPlay);
    el.addEventListener('pause', this.boundPause);
    el.addEventListener('progress', this.boundProgress);
    el.addEventListener('waiting', this.boundWaiting);
    el.addEventListener('playing', this.boundPlaying);
  }

  private detachAudioEvents(el: HTMLAudioElement) {
    el.removeEventListener('timeupdate', this.boundTimeupdate);
    el.removeEventListener('durationchange', this.boundDurationchange);
    el.removeEventListener('ended', this.boundEnded);
    el.removeEventListener('error', this.boundError);
    el.removeEventListener('play', this.boundPlay);
    el.removeEventListener('pause', this.boundPause);
    el.removeEventListener('progress', this.boundProgress);
    el.removeEventListener('waiting', this.boundWaiting);
    el.removeEventListener('playing', this.boundPlaying);
  }

  private setupMprisListeners() {
    const api = window.electronAPI;
    if (!api?.onMprisPlay) return;

    api.onMprisPlay(() => {
      if (this.useMpv && this.mpvReady) {
        api.mpvSetPause(false);
      } else {
        this.audio.play();
      }
    });
    api.onMprisPause(() => {
      if (this.useMpv && this.mpvReady) {
        api.mpvSetPause(true);
      } else {
        this.audio.pause();
      }
    });
    api.onMprisPlayPause(() => {
      if (this.useMpv && this.mpvReady) {
        api.mpvSetPause(!this.mpvPaused);
      } else if (this.audio.paused) {
        this.audio.play();
      } else {
        this.audio.pause();
      }
    });
    api.onMprisNext(() => {
      this.nextCallbacks.forEach(cb => cb());
    });
    api.onMprisPrevious(() => {
      this.prevCallbacks.forEach(cb => cb());
    });
    api.onMprisStop(() => {
      this.stop();
    });
    api.onMprisSeek((data) => {
      const pos = this.useMpv && this.mpvReady ? this.mpvPosition : this.audio.currentTime;
      const newPos = Math.max(0, pos + data.offset);
      if (this.useMpv && this.mpvReady) {
        api.mpvSeek(newPos);
      } else {
        this.audio.currentTime = newPos;
      }
    });
    api.onMprisSetPosition((data) => {
      if (this.useMpv && this.mpvReady) {
        api.mpvSeek(data.position);
      } else {
        this.audio.currentTime = data.position;
      }
    });
    api.onMprisVolume((data) => {
      this.setVolume(data.volume / 100);
    });
  }

  private mprisSetMetadata(track: Track, artworkUrl?: string) {
    const api = window.electronAPI;
    if (!api?.mprisUpdateMetadata) return;
    this.mprisArtworkUrl = artworkUrl || null;
    this.mprisCurrentTrack = track;
    api.mprisUpdateMetadata({
      id: track.id,
      title: track.title || 'Unknown',
      artist: getArtistDisplay(track).text || 'Unknown Artist',
      album: track.album || 'Unknown Album',
      duration: this.useMpv && this.mpvReady ? this.mpvDuration : (this.audio.duration || 0),
      artworkUrl: artworkUrl || '',
    });
  }

  private mprisSetPlayback(status: 'Playing' | 'Paused' | 'Stopped') {
    window.electronAPI?.mprisUpdatePlayback?.(status);
  }

  private mprisSetPosition(positionSec: number) {
    window.electronAPI?.mprisUpdatePosition?.(positionSec);
  }

  private mprisSetVolume(volume: number) {
    window.electronAPI?.mprisUpdateVolume?.(Math.round(volume * 100));
  }

  private async initAudioPipeline() {
    if (this.audioCtx) {
      if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();
      if (this.currentSource && this.currentSource.mediaElement !== this.audio) {
        this.currentSource.disconnect();
        const source = this.audioCtx.createMediaElementSource(this.audio);
        source.connect(this.gainNode!);
        this.currentSource = source;
      }
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
      this.currentSource = source;
      this.gainNode = gain;
      this.analyserNode = analyser;
      this.audio.addEventListener('volumechange', () => {
        if (this.gainNode) this.gainNode.gain.value = this.audio.volume;
      });
    } catch { /* already created */ }
  }

  async play(_track: Track, url: string): Promise<void> {
    if (this.useMpv && this.mpvReady) {
      this.mpvPreloadedNext = false;
      this.mpvAutoAdvanced = false;
      this.mpvInAutoAdvanceTransition = false;
      this.mpvLastPreloadedUrl = null;
      window.electronAPI.mpvLoad(url);
      this.mprisSetPlayback('Playing');
      return;
    }
    if (this.preloadAudio && this.preloadUrl === url) {
      const old = this.audio;
      this.detachAudioEvents(old);
      this.audio = this.preloadAudio;
      this.audio.volume = old.volume;
      this.preloadAudio = null;
      this.preloadUrl = null;
      this.attachAudioEvents(this.audio);
      await this.initAudioPipeline();
      if (this.audio.duration && isFinite(this.audio.duration)) {
        this.durationCallbacks.forEach(cb => cb(this.audio.duration));
      }
      try {
        this.pendingPlay = this.audio.play();
        await Promise.race([
          this.pendingPlay,
          new Promise<void>((_, reject) => setTimeout(() => reject(new Error('playback timeout')), 15000)),
        ]);
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === 'AbortError' && !this.audio.paused) return;
        throw e;
      }
      try { old.pause(); old.src = ''; } catch {}
      return;
    }
    this.preloadAudio = null;
    this.preloadUrl = null;
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
    if (this.useMpv && this.mpvReady) {
      window.electronAPI.mpvSetPause(true);
      this.mprisSetPlayback('Paused');
      return;
    }
    try { await this.pendingPlay; } catch { /* already rejected */ }
    this.audio.pause();
  }

  async resume(): Promise<void> {
    if (this.useMpv && this.mpvReady) {
      window.electronAPI.mpvSetPause(false);
      this.mprisSetPlayback('Playing');
      return;
    }
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
    if (this.useMpv && this.mpvReady) {
      window.electronAPI.mpvStopPlayback();
      this.mprisSetPlayback('Stopped');
      return;
    }
    this.audio.pause();
    this.audio.currentTime = 0;
    this.audio.src = '';
  }

  async seek(position: number): Promise<void> {
    if (this.useMpv && this.mpvReady) {
      window.electronAPI.mpvSeek(position);
      window.electronAPI?.mprisSeeked?.(position);
      return;
    }
    this.audio.currentTime = position;
  }

  async setVolume(volume: number): Promise<void> {
    if (this.useMpv && this.mpvReady) {
      window.electronAPI.mpvSetVolume(volume);
      this.mprisSetVolume(volume);
      return;
    }
    this.audio.volume = volume;
  }

  preload(url: string): void {
    if (this.useMpv && this.mpvReady) {
      if (this.mpvLastPreloadedUrl === url) return;
      this.mpvLastPreloadedUrl = url;
      this.mpvPreloadedNext = true;
      window.electronAPI.mpvPlaylistClear();
      window.electronAPI.mpvLoad(url, { append: true });
      return;
    }
    if (this.preloadAudio) {
      this.preloadAudio.src = '';
    }
    this.preloadUrl = url;
    this.preloadAudio = new Audio();
    this.preloadAudio.crossOrigin = 'anonymous';
    this.preloadAudio.preload = 'auto';
    this.preloadAudio.src = url;
    this.preloadAudio.load();
  }

  async getPosition(): Promise<number> {
    if (this.useMpv && this.mpvReady) return this.mpvPosition;
    return this.audio.currentTime;
  }

  async getDuration(): Promise<number> {
    if (this.useMpv && this.mpvReady) return this.mpvDuration;
    return this.audio.duration || 0;
  }

  async setMediaMetadata(track: Track, artworkUrl?: string): Promise<void> {
    this.mprisSetMetadata(track, artworkUrl);
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title || 'Unknown',
        artist: getArtistDisplay(track).text || 'Unknown Artist',
        album: track.album || 'Unknown Album',
        artwork: artworkUrl ? [{ src: artworkUrl, sizes: '512x512', type: 'image/jpeg' }] : [],
      });
    }
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

  onBufferingChange(callback: (isBuffering: boolean) => void): () => void {
    this.bufferingCallbacks.add(callback);
    return () => this.bufferingCallbacks.delete(callback);
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

  async checkForUpdate(): Promise<UpdateCheckResult> {
    return await window.electronAPI.updaterCheck();
  }

  async downloadUpdate(): Promise<void> {
    await window.electronAPI.updaterDownload();
  }

  installUpdate(): void {
    window.electronAPI.updaterInstall();
  }

  async getUpdateProgress(): Promise<DownloadProgress | null> {
    return await window.electronAPI.updaterGetProgress();
  }

  async canAutoUpdate(): Promise<boolean> {
    return await window.electronAPI.updaterCanAutoUpdate();
  }

  async getAppVersion(): Promise<string> {
    return await window.electronAPI.getAppVersion();
  }

  onUpdateDownloadProgress(callback: (progress: DownloadProgress) => void): () => void {
    return window.electronAPI.onUpdaterDownloadProgress(callback);
  }

  onUpdateDownloaded(callback: () => void): () => void {
    return window.electronAPI.onUpdaterDownloadComplete(callback);
  }

  onUpdateError(callback: (error: string) => void): () => void {
    return window.electronAPI.onUpdaterError(callback);
  }

  getAudioElement(): HTMLAudioElement | null {
    if (this.useMpv && this.mpvReady) return null;
    return this.audio;
  }

  getAnalyser(): AnalyserNode | null {
    if (this.useMpv && this.mpvReady) return null;
    return this.analyserNode;
  }

  async detectMpv(): Promise<boolean> {
    return window.electronAPI.mpvDetect();
  }

  async enableMpv(): Promise<boolean> {
    if (this.useMpv && this.mpvReady) return true;
    const ok = await window.electronAPI.mpvStart();
    if (!ok) return false;
    try { this.audio.pause(); } catch {}
    this.useMpv = true;
    this.mpvReady = true;
    this.mpvPosition = 0;
    this.mpvDuration = 0;
    this.mpvPaused = true;
    this.mpvPreloadedNext = false;
    this.mpvAutoAdvanced = false;
    this.mpvInAutoAdvanceTransition = false;
    this.mpvLastPreloadedUrl = null;
    this.setupMpvListeners();
    window.electronAPI.mpvSetVolume(this.audio.volume);
    return true;
  }

  disableMpv(): void {
    if (this.mpvPropertyUnsub) { this.mpvPropertyUnsub(); this.mpvPropertyUnsub = null; }
    if (this.mpvEndFileUnsub) { this.mpvEndFileUnsub(); this.mpvEndFileUnsub = null; }
    window.electronAPI.mpvStop().catch(() => {});
    this.useMpv = false;
    this.mpvReady = false;
    this.mpvPosition = 0;
    this.mpvDuration = 0;
    this.mpvPaused = true;
    this.mpvPreloadedNext = false;
    this.mpvAutoAdvanced = false;
    this.mpvInAutoAdvanceTransition = false;
    this.mpvLastPreloadedUrl = null;
    this.mprisSetPlayback('Stopped');
  }

  isMpvEnabled(): boolean {
    return this.useMpv && this.mpvReady;
  }

  consumeMpvAutoAdvanced(): boolean {
    const v = this.mpvAutoAdvanced;
    this.mpvAutoAdvanced = false;
    return v;
  }

  private setupMpvListeners() {
    this.mpvPropertyUnsub = window.electronAPI.onMpvProperty((data) => {
      switch (data.name) {
        case 'time-pos':
          this.mpvPosition = (data.data as number) ?? 0;
          if (this.mpvPosition > 0.5) {
            this.mpvInAutoAdvanceTransition = false;
          }
          this.positionCallbacks.forEach(cb => cb(this.mpvPosition));
          this.mprisSetPosition(this.mpvPosition);
          break;
        case 'duration':
          this.mpvDuration = (data.data as number) ?? 0;
          this.durationCallbacks.forEach(cb => cb(this.mpvDuration));
          this.mprisSetMetadata(this.mprisCurrentTrack!, this.mprisArtworkUrl || undefined);
          break;
        case 'pause':
          this.mpvPaused = data.data as boolean;
          this.playStateCallbacks.forEach(cb => cb(!this.mpvPaused));
          this.mprisSetPlayback(this.mpvPaused ? 'Paused' : 'Playing');
          break;
      }
    });

    this.mpvEndFileUnsub = window.electronAPI.onMpvEndFile((data) => {
      console.log('[mpv] end-file:', data.reason, 'preloaded:', this.mpvPreloadedNext, 'transition:', this.mpvInAutoAdvanceTransition, 'listeners:', this.trackEndCallbacks.size);
      if (data.reason === 'stop') return;
      if (data.reason === 'error') {
        this.trackErrorCallbacks.forEach(cb => cb('mpv playback error'));
        return;
      }
      if (data.reason === 'eof' && this.mpvInAutoAdvanceTransition) {
        console.log('[mpv] ignoring phantom eof during auto-advance transition');
        return;
      }
      if (this.mpvPreloadedNext) {
        this.mpvPreloadedNext = false;
        this.mpvAutoAdvanced = true;
        this.mpvInAutoAdvanceTransition = true;
      }
      this.trackEndCallbacks.forEach(cb => cb());
    });
  }

  async mpvNext(): Promise<void> {
    if (this.useMpv && this.mpvReady) {
      await window.electronAPI.mpvPlaylistNext();
    }
  }

  async relaunchApp(): Promise<void> {
    await window.electronAPI.relaunchApp();
  }
}
