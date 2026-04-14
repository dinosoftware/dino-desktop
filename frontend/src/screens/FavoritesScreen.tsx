import { useEffect, useState } from 'react';
import { apiClient } from '@/api/client';
import type { Track, Album, Artist, GetStarred2Response } from '@/api/types';
import { Music, Heart } from 'lucide-react';
import { LoadingScreen } from '@/components/ui';
import { AlbumCard, ArtistCard, TrackRow } from '@/components';
import { cn } from '@/lib/utils';

type TabType = 'songs' | 'albums' | 'artists';

export function FavoritesScreen() {
  const [view, setView] = useState<TabType>('songs');
  const [songs, setSongs] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.request<GetStarred2Response>('getStarred2');
      setSongs(data.starred2?.song || []);
      setAlbums(data.starred2?.album || []);
      setArtists(data.starred2?.artist || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load favorites');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingScreen />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 animate-fade-in">
        <Music className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-destructive text-sm">{error}</p>
        <button onClick={loadData} className="text-sm text-primary hover:underline">Retry</button>
      </div>
    );
  }

  const hasNoFavorites = songs.length === 0 && albums.length === 0 && artists.length === 0;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Favorites</h1>

      {hasNoFavorites ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground animate-fade-in">
          <Heart className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm">No favorites yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Star songs, albums, or artists to see them here</p>
        </div>
      ) : (
        <>
          <div className="flex gap-1 border-b">
            {([
              { key: 'songs' as TabType, count: songs.length },
              { key: 'albums' as TabType, count: albums.length },
              { key: 'artists' as TabType, count: artists.length },
            ]).map(({ key, count }) => (
              count > 0 && (
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
              )
            ))}
          </div>

          {view === 'songs' && (
            songs.length === 0 ? (
              <div className="text-muted-foreground text-center py-12 text-sm">No favorite songs</div>
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
              <div className="text-muted-foreground text-center py-12 text-sm">No favorite albums</div>
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
              <div className="text-muted-foreground text-center py-12 text-sm">No favorite artists</div>
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
    </div>
  );
}
