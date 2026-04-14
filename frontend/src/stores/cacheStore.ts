import { create } from 'zustand';
import type { Album, Playlist, AlbumWithSongsID3, ArtistWithAlbumsID3 } from '@/api/types';

interface CacheState {
  albums: Map<string, { data: AlbumWithSongsID3; timestamp: number }>;
  artists: Map<string, { data: ArtistWithAlbumsID3; timestamp: number }>;
  albumLists: Map<string, { data: Album[]; timestamp: number }>;
  playlists: Map<string, { data: Playlist[]; timestamp: number }>;
  
  getAlbum: (id: string) => AlbumWithSongsID3 | null;
  setAlbum: (id: string, album: AlbumWithSongsID3) => void;
  getAlbumList: (key: string) => Album[] | null;
  setAlbumList: (key: string, albums: Album[]) => void;
  getArtist: (id: string) => ArtistWithAlbumsID3 | null;
  setArtist: (id: string, artist: ArtistWithAlbumsID3) => void;
  getPlaylists: () => Playlist[] | null;
  setPlaylists: (playlists: Playlist[]) => void;
}

const CACHE_TTL = 5 * 60 * 1000;

export const useCacheStore = create<CacheState>((set, get) => ({
  albums: new Map(),
  artists: new Map(),
  albumLists: new Map(),
  playlists: new Map(),

  getAlbum: (id) => {
    const cached = get().albums.get(id);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    return null;
  },

  setAlbum: (id, album) => {
    set((state) => {
      const albums = new Map(state.albums);
      albums.set(id, { data: album, timestamp: Date.now() });
      return { albums };
    });
  },

  getAlbumList: (key) => {
    const cached = get().albumLists.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    return null;
  },

  setAlbumList: (key, albums) => {
    set((state) => {
      const albumLists = new Map(state.albumLists);
      albumLists.set(key, { data: albums, timestamp: Date.now() });
      return { albumLists };
    });
  },

  getArtist: (id) => {
    const cached = get().artists.get(id);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    return null;
  },

  setArtist: (id, artist) => {
    set((state) => {
      const artists = new Map(state.artists);
      artists.set(id, { data: artist, timestamp: Date.now() });
      return { artists };
    });
  },

  getPlaylists: () => {
    const cached = get().playlists.get('all');
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    return null;
  },

  setPlaylists: (playlists) => {
    set((state) => {
      const newPlaylists = new Map(state.playlists);
      newPlaylists.set('all', { data: playlists, timestamp: Date.now() });
      return { playlists: newPlaylists };
    });
  },
}));
