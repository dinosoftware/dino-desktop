import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayerStore } from '@/stores';
import { useAlbumActions } from '@/hooks';
import { apiClient } from '@/api/client';
import type { Track } from '@/api/types';
import { Play, Pause, Music, ListPlus, Disc, User, Heart, Radio, Download, Share2 } from 'lucide-react';
import { ContextMenu, type ContextMenuItem } from '@/components/ContextMenu';
import { cn, formatTime, getArtistDisplay } from '@/lib/utils';

interface TrackRowProps {
  track: Track;
  index: number;
  allTracks: Track[];
  showAlbum?: boolean;
  showCover?: boolean;
  onPlay?: () => void;
}

export function TrackRow({ track, index, allTracks, showAlbum = true, showCover = true, onPlay }: TrackRowProps) {
  const navigate = useNavigate();
  const { currentTrack, isPlaying, pause, playQueue } = usePlayerStore();
  const { playTrackNext, toggleStar } = useAlbumActions();

  const coverUrl = useMemo(() =>
    track.coverArt ? apiClient.buildCoverArtUrl(track.coverArt, 80) : null,
    [track.coverArt]
  );

  const isThisPlaying = currentTrack?.id === track.id;

  const handlePlay = () => {
    if (onPlay) {
      onPlay();
      return;
    }
    if (isThisPlaying && isPlaying) {
      pause();
    } else {
      const trackIndex = allTracks.findIndex(t => t.id === track.id);
      playQueue(allTracks, trackIndex >= 0 ? trackIndex : 0);
    }
  };

  const handleShare = async () => {
    const text = `${track.title} - ${getArtistDisplay(track).text || 'Unknown Artist'}`;
    const url = apiClient.getServerUrl();
    if (navigator.share) {
      navigator.share({ title: track.title, text, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(`${text}${url ? ` (${url})` : ''}`);
    }
  };

  const contextItems: ContextMenuItem[] = [
    { label: 'Play', icon: <Play className="h-4 w-4" />, onClick: handlePlay },
    { label: 'Play Next', icon: <ListPlus className="h-4 w-4" />, onClick: () => playTrackNext(track) },
    { label: 'Add to Queue', icon: <ListPlus className="h-4 w-4" />, onClick: () => usePlayerStore.getState().addToQueue([track]) },
    { label: 'Instant Mix', icon: <Radio className="h-4 w-4" />, onClick: async () => {
      const songs = await apiClient.getSimilarSongs(track.id);
      if (songs.length > 0) usePlayerStore.getState().playQueue([track, ...songs]);
    }, divider: true },
    { label: track.starred ? 'Unstar' : 'Star', icon: <Heart className="h-4 w-4" />, onClick: () => toggleStar(track.id, !!track.starred) },
    { label: 'Download', icon: <Download className="h-4 w-4" />, onClick: () => apiClient.downloadTrack(track).catch(() => {}), divider: true },
    { label: 'Share', icon: <Share2 className="h-4 w-4" />, onClick: handleShare },
    ...(track.albumId ? [{ label: 'Go to Album', icon: <Disc className="h-4 w-4" />, onClick: () => navigate(`/album/${track.albumId}`), divider: true }] : []),
    ...(track.artistId ? [{ label: 'Go to Artist', icon: <User className="h-4 w-4" />, onClick: () => navigate(`/artist/${track.artistId}`) }] : []),
  ];

  return (
    <ContextMenu items={contextItems}>
      <div
        onClick={handlePlay}
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm cursor-pointer transition-all duration-150 group',
          isThisPlaying ? 'bg-primary/10' : 'hover:bg-accent/50'
        )}
      >
        {showCover ? (
          <div className="h-10 w-10 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0 relative">
            {coverUrl ? (
              <img src={coverUrl} alt={track.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                <Music className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-150 flex items-center justify-center">
              {isThisPlaying && isPlaying ? (
                <Pause className="h-4 w-4 text-white drop-shadow-md" />
              ) : (
                <Play className="h-4 w-4 text-white drop-shadow-md ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </div>
            {isThisPlaying && isPlaying && (
              <div className="absolute inset-0 bg-black/40 flex items-end justify-center gap-0.5 pb-1">
                <div className="w-0.5 bg-white rounded-full animate-eq-1" style={{ height: '3px' }} />
                <div className="w-0.5 bg-white rounded-full animate-eq-2" style={{ height: '5px' }} />
                <div className="w-0.5 bg-white rounded-full animate-eq-3" style={{ height: '4px' }} />
              </div>
            )}
          </div>
        ) : (
          <span className="w-6 text-center text-xs text-muted-foreground font-medium tabular-nums flex-shrink-0">
            {isThisPlaying && isPlaying ? (
              <span className="flex items-center justify-center gap-0.5 h-4">
                <span className="w-0.5 bg-primary rounded-full animate-eq-1" style={{ height: '3px' }} />
                <span className="w-0.5 bg-primary rounded-full animate-eq-2" style={{ height: '5px' }} />
                <span className="w-0.5 bg-primary rounded-full animate-eq-3" style={{ height: '4px' }} />
              </span>
            ) : (
              index + 1
            )}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className={cn('font-medium truncate', isThisPlaying && 'text-primary')}>
            {track.title}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {getArtistDisplay(track).text}
            {showAlbum && track.album && track.album !== track.artist && (
              <span className="text-muted-foreground/70"> · {track.album}</span>
            )}
          </p>
        </div>

        <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0 ml-2">
          {formatTime(track.duration || 0)}
        </span>
      </div>
    </ContextMenu>
  );
}
