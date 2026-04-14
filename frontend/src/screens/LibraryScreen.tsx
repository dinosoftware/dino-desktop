import { useEffect, useState } from 'react';
import { apiClient } from '@/api/client';
import { useCacheStore } from '@/stores';
import type { Album, Artist, GetAlbumList2Response, ArtistsResponse } from '@/api/types';
import { Music, Disc3 } from 'lucide-react';
import { AlbumCard, ArtistCard } from '@/components';
import { cn } from '@/lib/utils';

type TabType = 'albums' | 'artists';

export function LibraryScreen() {
  const { getAlbumList, setAlbumList } = useCacheStore();
  const [view, setView] = useState<TabType>('albums');
  const [albums, setAlbums] = useState<Album[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [view]);

  const loadData = async () => {
    if (view === 'albums') {
      const cached = getAlbumList('all');
      if (cached && cached.length > 0) {
        setAlbums(cached);
        setLoading(false);
      }
    }

    setLoading(true);
    setError(null);
    try {
      if (view === 'albums') {
        const data = await apiClient.request<GetAlbumList2Response>('getAlbumList2', {
          type: 'alphabeticalByArtist',
          size: 500,
        });
        const albumList = data.albumList2?.album || [];
        setAlbums(albumList);
        setAlbumList('all', albumList);
      } else {
        const data = await apiClient.request<ArtistsResponse>('getArtists');
        const allArtists = data.artists?.index?.flatMap((i) => i.artist) || [];
        setArtists(allArtists);
      }
    } catch (err) {
      const cached = getAlbumList('all');
      if (!cached || cached.length === 0) {
        setError(err instanceof Error ? err.message : 'Failed to load library');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Library</h1>
        <div className="flex gap-1 border-b">
          {(['albums', 'artists'] as TabType[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'px-4 py-2 text-sm font-medium capitalize transition-all',
                view === v
                  ? 'border-b-2 border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {loading && albums.length === 0 && artists.length === 0 && (
        <div className="flex items-center justify-center h-64 animate-fade-in">
          <Disc3 className="h-10 w-10 text-primary animate-spin" style={{ animationDuration: '2s' }} />
        </div>
      )}

      {error && albums.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 animate-fade-in">
          <Music className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-destructive text-sm">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 active:scale-95 transition-all text-sm"
          >
            Retry
          </button>
        </div>
      )}

      {view === 'albums' && albums.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 animate-fade-in">
          {albums.map((album) => (
            <AlbumCard key={album.id} album={album} />
          ))}
        </div>
      )}

      {view === 'artists' && !loading && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 animate-fade-in">
          {artists.map((artist) => (
            <ArtistCard key={artist.id} artist={artist} />
          ))}
        </div>
      )}
    </div>
  );
}
