import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/api/client';
import { usePlayerStore } from '@/stores';
import type { Artist, GetArtistResponse, GetAlbumResponse } from '@/api/types';
import { Music, User, Play, Shuffle } from 'lucide-react';
import { ContextMenu, type ContextMenuItem } from '@/components/ContextMenu';

interface ArtistCardProps {
  artist: Artist;
  onClick?: () => void;
}

export function ArtistCard({ artist, onClick }: ArtistCardProps) {
  const navigate = useNavigate();
  const playQueue = usePlayerStore((s) => s.playQueue);

  const coverUrl = useMemo(() =>
    artist.coverArt ? apiClient.buildCoverArtUrl(artist.coverArt, 300) : null,
    [artist.coverArt]
  );

  const handleNavigate = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/artist/${artist.id}`);
    }
  };

  const handlePlayAll = async (shuffleMode: boolean) => {
    const artistData = await apiClient.request<GetArtistResponse>('getArtist', { id: artist.id });
    const albums = artistData.artist?.album || [];
    const allTracks: import('@/api/types').Track[] = [];
    for (const album of albums) {
      const albumData = await apiClient.request<GetAlbumResponse>('getAlbum', { id: album.id });
      if (albumData.album?.song) allTracks.push(...albumData.album.song);
    }
    if (allTracks.length > 0) {
      const startIdx = shuffleMode ? Math.floor(Math.random() * allTracks.length) : 0;
      if (shuffleMode) {
        for (let i = allTracks.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [allTracks[i], allTracks[j]] = [allTracks[j], allTracks[i]];
        }
      }
      playQueue(allTracks, startIdx);
    }
  };

  const contextItems: ContextMenuItem[] = [
    { label: 'Play All', icon: <Play className="h-4 w-4" />, onClick: () => handlePlayAll(false) },
    { label: 'Shuffle All', icon: <Shuffle className="h-4 w-4" />, onClick: () => handlePlayAll(true) },
    { label: 'Go to Artist', icon: <User className="h-4 w-4" />, onClick: handleNavigate, divider: true },
  ];

  return (
    <ContextMenu items={contextItems}>
      <div
        onClick={handleNavigate}
        className="cursor-pointer p-3 text-center rounded-xl hover:bg-accent/50 active:scale-[0.98] transition-all duration-200 group"
      >
        <div className="w-24 h-24 mx-auto rounded-full overflow-hidden bg-muted mb-3 shadow-md group-hover:shadow-lg transition-all duration-300">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={artist.name}
              className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-500"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
              <Music className="h-8 w-8 text-muted-foreground/30" />
            </div>
          )}
        </div>
        <h3 className="font-medium truncate text-sm">{artist.name}</h3>
        <p className="text-xs text-muted-foreground">{artist.albumCount || 0} albums</p>
      </div>
    </ContextMenu>
  );
}
