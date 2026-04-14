import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Track, Album } from '@/api/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function getArtistDisplay(item: Track | Album | null | undefined): { text: string; artists: { name: string; id?: string }[] } {
  if (!item) return { text: '', artists: [] };

  const rawArtists = (item as Track).artists || (item as Album).artists;
  const displayArtist = (item as Track).displayArtist || (item as Album).displayArtist;

  if (rawArtists && rawArtists.length > 0) {
    const artists = rawArtists.filter(a => a.name);
    const formatted = artists.length === 1
      ? artists[0].name
      : artists.length === 2
        ? `${artists[0].name} & ${artists[1].name}`
        : artists.slice(0, -1).map(a => a.name).join(', ') + ' & ' + artists[artists.length - 1].name;
    return { text: formatted, artists: artists.map(a => ({ name: a.name, id: a.id })) };
  }

  if (displayArtist) {
    return { text: displayArtist, artists: [{ name: displayArtist, id: item.artistId }] };
  }

  const single = item.artist;
  return { text: single || '', artists: single ? [{ name: single, id: item.artistId }] : [] };
}
