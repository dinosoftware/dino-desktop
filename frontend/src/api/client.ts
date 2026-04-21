import md5 from 'blueimp-md5';
import type { SubsonicResponse, GetLyricsResponse, GetArtistInfo2Response, GetArtistResponse, GetAlbumInfo2Response, StructuredLyrics, ArtistInfo2, ArtistWithAlbumsID3, AlbumInfo, SimilarSongs2Response, TopSongsResponse, Track, GetPlayQueueResponse, SavePlayQueueResponse } from './types';

const API_VERSION = '1.16.1';
const CLIENT_NAME = 'DinoDesktop';
const TIMEOUT = 30000;

function createTimeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

export interface ServerCredentials {
  username: string;
  token: string;
  salt: string;
  serverUrl: string;
}

class APIClient {
  private credentials: ServerCredentials | null = null;

  setCredentials(credentials: ServerCredentials) {
    this.credentials = credentials;
  }

  clearCredentials() {
    this.credentials = null;
  }

  hasCredentials(): boolean {
    return this.credentials !== null;
  }

  private generateAuthParams(): Record<string, string> {
    if (!this.credentials) {
      throw new Error('No credentials set');
    }
    return {
      v: API_VERSION,
      c: CLIENT_NAME,
      f: 'json',
      u: this.credentials.username,
      s: this.credentials.salt,
      t: this.credentials.token,
    };
  }

  private useProxy(serverUrl: string): boolean {
    if (serverUrl === '/') return false;
    return serverUrl === 'https://music.fuge.dev' &&
      typeof window !== 'undefined' &&
      window.location.hostname === 'localhost' &&
      !('electronAPI' in window);
  }

  private resolveBaseUrl(serverUrl: string): string {
    if (!serverUrl || serverUrl === '/') return '';
    if (this.useProxy(serverUrl)) return '/api';
    return serverUrl;
  }

  async request<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.credentials) {
      throw new Error('No credentials set');
    }

    const authParams = this.generateAuthParams();
    const allParams = { ...params, ...authParams };

    const baseUrl = this.resolveBaseUrl(this.credentials.serverUrl);

    const searchParams = new URLSearchParams();
    Object.entries(allParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(v => searchParams.append(key, String(v)));
        } else {
          searchParams.append(key, String(value));
        }
      }
    });

    const url = `${baseUrl}/rest/${endpoint}.view?${searchParams}`;

    const response = await fetch(url, {
      method: 'GET',
      signal: createTimeoutSignal(TIMEOUT),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication failed');
      }
      throw new Error(`HTTP error ${response.status}`);
    }

    const data: SubsonicResponse<T> = await response.json();

    if (data['subsonic-response'].status === 'failed') {
      throw new Error(data['subsonic-response'].error?.message || 'API error');
    }

    return data['subsonic-response'] as T;
  }

  async ping(serverUrl: string, username: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const salt = Math.random().toString(36).substring(2, 15);
      const token = md5(password + salt);

      const params = new URLSearchParams({
        v: API_VERSION,
        c: CLIENT_NAME,
        f: 'json',
        u: username,
        s: salt,
        t: token,
      });

      const baseUrl = this.resolveBaseUrl(serverUrl);

      const response = await fetch(`${baseUrl}/rest/ping.view?${params}`, {
        signal: createTimeoutSignal(TIMEOUT),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read response');
        return { success: false, error: `HTTP ${response.status}: ${errorText.slice(0, 100)}` };
      }

      const data: SubsonicResponse = await response.json();

      if (data['subsonic-response'].status === 'failed') {
        const errorMsg = data['subsonic-response'].error?.message || 'API returned failure';
        return { success: false, error: errorMsg };
      }

      return { success: data['subsonic-response'].status === 'ok' };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMsg };
    }
  }

  buildStreamUrl(trackId: string): string {
    if (!this.credentials) {
      throw new Error('No credentials set');
    }

    const baseUrl = this.resolveBaseUrl(this.credentials.serverUrl);

    const quality = localStorage.getItem('dino_quality');
    const format = localStorage.getItem('dino_format');

    let parsedQuality: string | undefined;
    let parsedFormat: string | undefined;
    try {
      if (quality) {
        const q = JSON.parse(quality);
        if (q === 'max') parsedQuality = undefined;
        else if (q === '0') parsedQuality = '0';
        else parsedQuality = q;
      }
    } catch { /* ignore */ }
    try {
      if (format) {
        const f = JSON.parse(format);
        if (f && f !== 'raw') parsedFormat = f.replace(/"/g, '');
      }
    } catch { /* ignore */ }

    const params = new URLSearchParams({
      ...this.generateAuthParams(),
      id: trackId,
      ...(parsedQuality ? { maxBitRate: parsedQuality } : {}),
      ...(parsedFormat ? { format: parsedFormat } : {}),
    });
    return `${baseUrl}/rest/stream.view?${params}`;
  }

  buildDownloadUrl(trackId: string): string {
    if (!this.credentials) {
      throw new Error('No credentials set');
    }
    const baseUrl = this.resolveBaseUrl(this.credentials.serverUrl);
    const params = new URLSearchParams({
      ...this.generateAuthParams(),
      id: trackId,
    });
    return `${baseUrl}/rest/download.view?${params}`;
  }

  async downloadTrack(track: import('./types').Track): Promise<void> {
    const url = this.buildDownloadUrl(track.id);
    const suffix = track.suffix || track.contentType?.split('/')[1] || 'mp3';
    const filename = `${track.title || 'track'}.${suffix}`;

    if (window.electronAPI) {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
    }
  }

  buildCoverArtUrl(coverArtId: string, size?: number): string {
    if (!this.credentials) {
      throw new Error('No credentials set');
    }

    const baseUrl = this.resolveBaseUrl(this.credentials.serverUrl);

    const params = new URLSearchParams({
      ...this.generateAuthParams(),
      id: coverArtId,
      ...(size ? { size: String(size) } : {}),
    });
    return `${baseUrl}/rest/getCoverArt.view?${params}`;
  }

  getServerUrl(): string {
    return this.credentials?.serverUrl || '';
  }

  async star(id: string): Promise<void> {
    await this.request<object>('star', { id });
  }

  async unstar(id: string): Promise<void> {
    await this.request<object>('unstar', { id });
  }

  async scrobble(id: string, submission?: boolean): Promise<void> {
    await this.request<object>('scrobble', {
      id,
      ...(submission !== undefined ? { submission } : {}),
    });
  }

  async getLyricsBySongId(songId: string): Promise<StructuredLyrics[]> {
    try {
      const data = await this.request<GetLyricsResponse>('getLyricsBySongId', { id: songId });
      const structured = data.lyricsList?.structuredLyrics || [];
      if (structured.length > 0) return structured;
    } catch {
      // no lyrics
    }
    return [];
  }

  async getArtistInfo2(artistId: string): Promise<ArtistInfo2 | null> {
    try {
      const data = await this.request<GetArtistInfo2Response>('getArtistInfo2', { id: artistId });
      return data.artistInfo2 || null;
    } catch {
      return null;
    }
  }

  async getArtist(artistId: string): Promise<ArtistWithAlbumsID3 | null> {
    try {
      const data = await this.request<GetArtistResponse>('getArtist', { id: artistId });
      return data.artist || null;
    } catch {
      return null;
    }
  }

  async getAlbumInfo2(albumId: string): Promise<AlbumInfo | null> {
    try {
      const data = await this.request<GetAlbumInfo2Response>('getAlbumInfo2', { id: albumId });
      return data.albumInfo || null;
    } catch {
      return null;
    }
  }

  async getSimilarSongs(songId: string, count = 50): Promise<Track[]> {
    try {
      const data = await this.request<SimilarSongs2Response>('getSimilarSongs2', { id: songId, count });
      return data.similarSongs2?.song || [];
    } catch {
      return [];
    }
  }

  async getTopSongs(artistName: string, count = 50): Promise<Track[]> {
    try {
      const data = await this.request<TopSongsResponse>('getTopSongs', { artist: artistName, count });
      return data.topSongs?.song || [];
    } catch {
      return [];
    }
  }

  async createPlaylist(name: string, songIds?: string[]): Promise<string | null> {
    try {
      const data = await this.request<{ id: string }>('createPlaylist', {
        name,
        ...(songIds?.length ? { songId: songIds } : {}),
      });
      return data.id || null;
    } catch {
      return null;
    }
  }

  async updatePlaylist(params: {
    playlistId: string;
    name?: string;
    comment?: string;
    songIdsToAdd?: string[];
    songIndexesToRemove?: number[];
  }): Promise<void> {
    await this.request<object>('updatePlaylist', {
      playlistId: params.playlistId,
      ...(params.name ? { name: params.name } : {}),
      ...(params.comment !== undefined ? { comment: params.comment } : {}),
      ...(params.songIdsToAdd?.length ? { songIdToAdd: params.songIdsToAdd } : {}),
      ...(params.songIndexesToRemove?.length ? { songIndexToRemove: params.songIndexesToRemove } : {}),
    });
  }

  async deletePlaylist(playlistId: string): Promise<void> {
    await this.request<object>('deletePlaylist', { id: playlistId });
  }

  async savePlayQueue(songIds: string[], currentId?: string, position?: number): Promise<void> {
    await this.request<SavePlayQueueResponse>('savePlayQueue', {
      id: songIds,
      ...(currentId ? { current: currentId } : {}),
      ...(position !== undefined ? { position } : {}),
    });
  }

  async getPlayQueue(): Promise<{ entries: Track[]; currentId?: string; position?: number }> {
    try {
      const data = await this.request<GetPlayQueueResponse>('getPlayQueue');
      const pq = data.playQueue;
      return {
        entries: pq?.entry || [],
        currentId: pq?.current,
        position: pq?.position,
      };
    } catch {
      return { entries: [] };
    }
  }
}

export const apiClient = new APIClient();
