import { useEffect, useState, useCallback } from 'react';
import { useAuthStore, useCacheStore } from '@/stores';
import { apiClient } from '@/api/client';
import type { Album, GetAlbumList2Response } from '@/api/types';
import { Music, RefreshCw, Disc3 } from 'lucide-react';
import { AlbumCard, HeroBanner } from '@/components';

type AlbumListType = 'recent' | 'random' | 'frequent' | 'newest';

interface AlbumSectionConfig {
  type: AlbumListType;
  title: string;
}

const ALBUM_SECTIONS: AlbumSectionConfig[] = [
  { type: 'recent', title: 'Recently Played' },
  { type: 'random', title: 'Random Picks' },
  { type: 'frequent', title: 'Most Played' },
  { type: 'newest', title: 'Newly Added' },
];

export function HomeScreen() {
  const { servers, currentServerId } = useAuthStore();
  const serverLock = useAuthStore((s) => s.serverLock);
  const { getAlbumList, setAlbumList } = useCacheStore();
  const [albumSections, setAlbumSections] = useState<Record<AlbumListType, Album[]>>({
    recent: [],
    random: [],
    frequent: [],
    newest: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<Set<AlbumListType>>(new Set());

  const loadData = useCallback(async () => {
    const cachedRecent = getAlbumList('recent');
    if (cachedRecent && cachedRecent.length > 0) {
      setAlbumSections((prev) => ({ ...prev, recent: cachedRecent }));
      setLoading(false);
    }

    try {
      setError(null);
      const albumsData = await apiClient.request<GetAlbumList2Response>('getAlbumList2', { type: 'recent', size: 20 });

      setAlbumSections((prev) => ({ ...prev, recent: albumsData.albumList2?.album || [] }));
      setAlbumList('recent', albumsData.albumList2?.album || []);

      loadOtherSections();
    } catch (err) {
      if (!cachedRecent || cachedRecent.length === 0) {
        setError(err instanceof Error ? err.message : 'Failed to load library');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOtherSections = useCallback(async () => {
    try {
      const [randomData, frequentData, newestData] = await Promise.all([
        apiClient.request<GetAlbumList2Response>('getAlbumList2', { type: 'random', size: 20 }),
        apiClient.request<GetAlbumList2Response>('getAlbumList2', { type: 'frequent', size: 20 }),
        apiClient.request<GetAlbumList2Response>('getAlbumList2', { type: 'newest', size: 20 }),
      ]);
      setAlbumSections((prev) => ({
        ...prev,
        random: randomData.albumList2?.album || [],
        frequent: frequentData.albumList2?.album || [],
        newest: newestData.albumList2?.album || [],
      }));
    } catch {
      // silently fail for secondary sections
    }
  }, []);

  const refreshSection = useCallback(async (type: AlbumListType) => {
    setRefreshing((prev) => new Set(prev).add(type));
    try {
      const data = await apiClient.request<GetAlbumList2Response>('getAlbumList2', { type, size: 20 });
      setAlbumSections((prev) => ({ ...prev, [type]: data.albumList2?.album || [] }));
    } catch {
      // silent
    } finally {
      setRefreshing((prev) => {
        const next = new Set(prev);
        next.delete(type);
        return next;
      });
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const currentServer = servers.find((s) => s.id === currentServerId);

  if (loading && albumSections.recent.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] animate-fade-in">
        <Disc3 className="h-10 w-10 text-primary animate-spin" style={{ animationDuration: '2s' }} />
      </div>
    );
  }

  if (error && albumSections.recent.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] gap-4 animate-fade-in">
        <Music className="h-16 w-16 text-muted-foreground/30" />
        <div className="text-destructive text-sm">{error}</div>
        <button
          onClick={loadData}
          className="px-4 py-2 rounded-lg hover:bg-accent active:scale-95 transition-all text-sm"
          style={{ backgroundColor: 'var(--toggle-on)', color: 'var(--toggle-on-knob)' }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Home</h1>
          {currentServer && !serverLock && <p className="text-sm text-muted-foreground mt-1">{currentServer.name}</p>}
        </div>
      </div>

      <HeroBanner />

      {ALBUM_SECTIONS.map((section) => {
        const albums = albumSections[section.type];
        if (albums.length === 0) return null;
        return (
          <AlbumSection
            key={section.type}
            title={section.title}
            albums={albums}
            isRefreshing={refreshing.has(section.type)}
            onRefresh={() => refreshSection(section.type)}
          />
        );
      })}
    </div>
  );
}

function AlbumSection({ title, albums, isRefreshing, onRefresh }: { title: string; albums: Album[]; isRefreshing: boolean; onRefresh: () => void }) {
  const [showAll, setShowAll] = useState(false);
  const displayAlbums = showAll ? albums : albums.slice(0, 10);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        <div className="flex items-center gap-3">
          {albums.length > 10 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium"
            >
              {showAll ? 'Show less' : `See all (${albums.length})`}
            </button>
          )}
          <button
            onClick={onRefresh}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-accent"
            title={`Refresh ${title}`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
        {displayAlbums.map((album) => (
          <AlbumCard key={album.id} album={album} />
        ))}
      </div>
    </section>
  );
}
