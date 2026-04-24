import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayerStore } from '@/stores';
import { useAlbumActions } from '@/hooks';
import { apiClient } from '@/api/client';
import type { Album } from '@/api/types';
import { Play, Pause, Music, ListPlus, Disc, User, Heart, Shuffle, Share2 } from 'lucide-react';
import { ContextMenu, type ContextMenuItem } from '@/components/ContextMenu';
import { cn, getArtistDisplay } from '@/lib/utils';
import { usePlatform } from '@/platform';
import { useToastStore } from '@/stores/toastStore';

interface AlbumCardProps {
  album: Album;
  onClick?: () => void;
}

export function AlbumCard({ album, onClick }: AlbumCardProps) {
  const navigate = useNavigate();
  const { currentTrack, isPlaying, pause } = usePlayerStore();
  const { playAlbum, shuffleAlbum, playAlbumNext, addAlbumToQueue, toggleStar } = useAlbumActions();
  const platform = usePlatform();
  const toast = useToastStore();

  const coverUrl = useMemo(() =>
    album.coverArt ? apiClient.buildCoverArtUrl(album.coverArt, 300) : null,
    [album.coverArt]
  );

  const isThisAlbumPlaying = currentTrack?.albumId === album.id;

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isThisAlbumPlaying && isPlaying) {
      pause();
    } else {
      playAlbum(album.id);
    }
  };

  const handleNavigate = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/album/${album.id}`);
    }
  };

  const contextItems: ContextMenuItem[] = [
    { label: 'Play', icon: <Play className="h-4 w-4" />, onClick: () => playAlbum(album.id) },
    { label: 'Shuffle', icon: <Shuffle className="h-4 w-4" />, onClick: () => shuffleAlbum(album.id) },
    { label: 'Play Next', icon: <ListPlus className="h-4 w-4" />, onClick: () => playAlbumNext(album.id) },
    { label: 'Add to Queue', icon: <ListPlus className="h-4 w-4" />, onClick: () => addAlbumToQueue(album.id) },
    { label: album.starred ? 'Unstar' : 'Star', icon: <Heart className="h-4 w-4" />, onClick: () => toggleStar(album.id, !!album.starred), divider: true },
    { label: 'Share', icon: <Share2 className="h-4 w-4" />, onClick: async () => {
      const shareEnabled = (() => { try { const v = localStorage.getItem('dino_shares'); return v ? JSON.parse(v) : true; } catch { return true; } })();
      if (!shareEnabled) return;
      const share = await apiClient.createShare([album.id], album.name);
      if (share?.url) {
        if (platform.writeClipboard) { await platform.writeClipboard(share.url); }
        else { try { await navigator.clipboard.writeText(share.url); } catch { /* ignore */ } }
        toast.showToast('Link copied!', 'share');
      }
    } },
    { label: 'Go to Album', icon: <Disc className="h-4 w-4" />, onClick: handleNavigate, divider: true },
    ...(album.artistId ? [{ label: 'Go to Artist', icon: <User className="h-4 w-4" />, onClick: () => navigate(`/artist/${album.artistId}`) }] : []),
  ];

  return (
    <ContextMenu items={contextItems}>
      <div
        onClick={handleNavigate}
        className="group cursor-pointer p-1.5 rounded-lg hover:bg-accent/50 active:scale-[0.98] transition-all duration-200"
      >
        <div className="relative aspect-square rounded-md overflow-hidden bg-muted mb-1.5 shadow-md group-hover:shadow-lg transition-all duration-300">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={album.name}
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
              <Music className="h-8 w-8 text-muted-foreground/30" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
            <button
              onClick={handlePlayClick}
              className={cn(
                'h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg transition-all duration-300',
                'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0',
                'hover:scale-110 active:scale-95'
              )}
            >
              {isThisAlbumPlaying && isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4 ml-0.5" />
              )}
            </button>
          </div>
          {isThisAlbumPlaying && isPlaying && (
            <div className="absolute bottom-2 left-2 flex items-end gap-0.5 h-4 p-1 rounded-md bg-black/60 backdrop-blur-sm">
              <div className="w-0.5 bg-white rounded-full animate-eq-1" style={{ height: '3px' }} />
              <div className="w-0.5 bg-white rounded-full animate-eq-2" style={{ height: '6px' }} />
              <div className="w-0.5 bg-white rounded-full animate-eq-3" style={{ height: '4px' }} />
            </div>
          )}
        </div>
        <h3 className="font-medium truncate text-xs leading-tight">{album.name}</h3>
        <p
          onClick={(e) => {
            e.stopPropagation();
            if (album.artistId) navigate(`/artist/${album.artistId}`);
          }}
          className="text-xs text-muted-foreground truncate hover:text-primary cursor-pointer transition-colors"
        >
          {getArtistDisplay(album).text}
        </p>
      </div>
    </ContextMenu>
  );
}
