import { useCallback } from 'react';
import { usePlayerStore } from '@/stores';
import { apiClient } from '@/api/client';
import type { Track, GetAlbumResponse } from '@/api/types';

export function useAlbumActions() {
  const playAlbum = useCallback(async (albumId: string, startIndex = 0) => {
    const data = await apiClient.request<GetAlbumResponse>('getAlbum', { id: albumId });
    const songs = data.album?.song || [];
    if (songs.length > 0) {
      usePlayerStore.getState().playQueue(songs, startIndex);
    }
  }, []);

  const shuffleAlbum = useCallback(async (albumId: string) => {
    const data = await apiClient.request<GetAlbumResponse>('getAlbum', { id: albumId });
    const songs = data.album?.song || [];
    if (songs.length > 0) {
      for (let i = songs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [songs[i], songs[j]] = [songs[j], songs[i]];
      }
      usePlayerStore.getState().playQueue(songs, 0);
    }
  }, []);

  const playAlbumNext = useCallback(async (albumId: string) => {
    const data = await apiClient.request<GetAlbumResponse>('getAlbum', { id: albumId });
    const songs = data.album?.song || [];
    if (songs.length > 0) {
      usePlayerStore.getState().addNext(songs);
    }
  }, []);

  const addAlbumToQueue = useCallback(async (albumId: string) => {
    const data = await apiClient.request<GetAlbumResponse>('getAlbum', { id: albumId });
    const songs = data.album?.song || [];
    if (songs.length > 0) {
      usePlayerStore.getState().addToQueue(songs);
    }
  }, []);

  const playTrackNext = useCallback((track: Track) => {
    usePlayerStore.getState().addNext([track]);
  }, []);

  const toggleStar = useCallback(async (id: string, isStarred: boolean) => {
    if (isStarred) {
      await apiClient.unstar(id);
    } else {
      await apiClient.star(id);
    }
  }, []);

  return { playAlbum, shuffleAlbum, playAlbumNext, addAlbumToQueue, playTrackNext, toggleStar };
}
