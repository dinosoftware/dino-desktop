import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/api/client';
import type { Track, Album, Artist, SearchResponse3 } from '@/api/types';
import { Search as SearchIcon, X, Music } from 'lucide-react';
import { LoadingScreen } from '@/components/ui';
import { AlbumCard, ArtistCard, TrackRow } from '@/components';
import { cn } from '@/lib/utils';

type TabType = 'songs' | 'albums' | 'artists';

export function SearchScreen() {
  const [query, setQuery] = useState('');
  const [view, setView] = useState<TabType>('songs');
  const [songs, setSongs] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setSongs([]);
      setAlbums([]);
      setArtists([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const data = await apiClient.request<SearchResponse3>('search3', {
        query: searchQuery,
        songCount: 50,
        albumCount: 30,
        artistCount: 20,
      });
      setSongs(data.searchResult3?.song || []);
      setAlbums(data.searchResult3?.album || []);
      setArtists(data.searchResult3?.artist || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query) search(query);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [query, search]);

  if (loading && !hasSearched) return <LoadingScreen />;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Search</h1>

      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search songs, albums, artists..."
          className="w-full h-11 pl-9 pr-9 rounded-xl border bg-card focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow text-sm"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setHasSearched(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {error && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 animate-fade-in">
          <Music className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-destructive text-sm">{error}</p>
          <button onClick={() => search(query)} className="text-sm text-primary hover:underline">Retry</button>
        </div>
      )}

      {!loading && !error && hasSearched && (
        <>
          <div className="flex gap-1 border-b">
            {([
              { key: 'songs' as TabType, count: songs.length },
              { key: 'albums' as TabType, count: albums.length },
              { key: 'artists' as TabType, count: artists.length },
            ]).map(({ key, count }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium capitalize transition-all',
                  view === key
                    ? 'border-b-2 border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {key} <span className="text-muted-foreground/70">({count})</span>
              </button>
            ))}
          </div>

          {view === 'songs' && (
            songs.length === 0 ? (
              <EmptyState message="No songs found" />
            ) : (
              <div className="space-y-0.5 animate-fade-in">
                {songs.map((song, idx) => (
                  <TrackRow key={song.id} track={song} index={idx} allTracks={songs} />
                ))}
              </div>
            )
          )}

          {view === 'albums' && (
            albums.length === 0 ? (
              <EmptyState message="No albums found" />
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 animate-fade-in">
                {albums.map((album) => (
                  <AlbumCard key={album.id} album={album} />
                ))}
              </div>
            )
          )}

          {view === 'artists' && (
            artists.length === 0 ? (
              <EmptyState message="No artists found" />
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 animate-fade-in">
                {artists.map((artist) => (
                  <ArtistCard key={artist.id} artist={artist} />
                ))}
              </div>
            )
          )}
        </>
      )}

      {!hasSearched && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground animate-fade-in">
          <SearchIcon className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm">Search for your favorite music</p>
        </div>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-muted-foreground text-center py-16 text-sm animate-fade-in">{message}</div>
  );
}
