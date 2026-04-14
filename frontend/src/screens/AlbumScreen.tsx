import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '@/api/client';
import { usePlayerStore, useCacheStore } from '@/stores';
import { useAlbumActions } from '@/hooks';
import type { AlbumWithSongsID3, GetAlbumResponse } from '@/api/types';
import { Play, Pause, Shuffle, ArrowLeft, Clock, Music, Heart, ListPlus, User, Disc, Radio } from 'lucide-react';
import { cn, formatTime, getArtistDisplay } from '@/lib/utils';
import { LoadingScreen } from '@/components/ui';
import { ContextMenu, type ContextMenuItem } from '@/components/ContextMenu';

export function AlbumScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTrack, isPlaying, playQueue, pause, addToQueue } = usePlayerStore();
  const { getAlbum, setAlbum } = useCacheStore();
  const { playTrackNext, toggleStar } = useAlbumActions();

  const [album, setAlbumState] = useState<AlbumWithSongsID3 | null>(null);
  const [tracks, setTracks] = useState<import('@/api/types').Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const cached = getAlbum(id);
    if (cached) {
      setAlbumState(cached);
      setTracks(cached.song || []);
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const data = await apiClient.request<GetAlbumResponse>('getAlbum', { id });
        if (data.album) {
          setAlbumState(data.album);
          setTracks(data.album.song || []);
          setAlbum(id, data.album);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, getAlbum, setAlbum]);

  const coverUrl = useMemo(() =>
    album?.coverArt ? apiClient.buildCoverArtUrl(album.coverArt, 400) : null,
    [album?.coverArt]
  );

  const headerCoverUrl = useMemo(() =>
    album?.coverArt ? apiClient.buildCoverArtUrl(album.coverArt, 600) : null,
    [album?.coverArt]
  );

  const isAlbumPlaying = currentTrack && tracks.some((t) => t.id === currentTrack.id);
  const totalDuration = tracks.reduce((acc, t) => acc + (t.duration || 0), 0);

  const handlePlayAll = (shuffleMode = false) => {
    if (isAlbumPlaying && isPlaying) {
      pause();
    } else {
      playQueue(tracks, shuffleMode ? Math.floor(Math.random() * tracks.length) : 0);
    }
  };

  if (loading) return <LoadingScreen />;

  if (!album) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 animate-fade-in">
        <Music className="h-16 w-16" style={{ color: 'hsl(var(--muted-foreground))', opacity: 0.3 }} />
        <div style={{ color: 'hsl(var(--muted-foreground))' }} className="text-sm">Album not found</div>
        <button onClick={() => navigate(-1)} className="text-sm text-primary hover:underline">Go back</button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="relative overflow-hidden">
        {headerCoverUrl && (
          <>
            <div className="absolute inset-0 bg-cover bg-center scale-110" style={{ backgroundImage: `url(${headerCoverUrl})`, filter: 'blur(4px)', opacity: 0.3 }} />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent, hsl(var(--background)))' }} />
          </>
        )}
        <div className="relative z-10" style={{ background: headerCoverUrl ? '' : 'linear-gradient(to bottom, var(--album-header-bg), transparent)' }}>
          <div className="p-6 max-w-5xl mx-auto">
            <button
              onClick={() => navigate(-1)}
              className="mb-6 flex items-center gap-2 px-2 py-1 -ml-2 rounded-md text-sm transition-colors"
              style={{ color: 'hsl(var(--muted-foreground))' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'hsl(var(--foreground))'; e.currentTarget.style.backgroundColor = 'hsl(var(--accent))'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'hsl(var(--muted-foreground))'; e.currentTarget.style.backgroundColor = ''; }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            <div className="flex gap-6 mb-8">
              <div className="w-52 h-52 flex-shrink-0 rounded-xl overflow-hidden bg-muted shadow-2xl">
                {coverUrl ? (
                  <img src={coverUrl} alt={album.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, var(--album-header-bg), var(--cover-placeholder-bg))' }}>
                    <Music className="h-16 w-16" style={{ color: 'hsl(var(--primary))', opacity: 0.3 }} />
                  </div>
                )}
              </div>
              <div className="flex flex-col justify-end min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>Album</p>
                <h1 className="text-4xl font-bold mb-2 truncate">{album.name}</h1>
                <div className="mb-4 text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  {album.artist && (
                    <span
                      onClick={() => album.artistId && navigate(`/artist/${album.artistId}`)}
                      className={cn('hover:text-primary cursor-pointer transition-colors font-medium', album.artistId && 'text-foreground')}
                    >
                      {album.artist}
                    </span>
                  )}
                  {album.year && <span style={{ opacity: 0.5 }} className="mx-2">&middot;</span>}
                  {album.year && <span>{album.year}</span>}
                  <span style={{ opacity: 0.5 }} className="mx-2">&middot;</span>
                  <span>{tracks.length} songs, {Math.floor(totalDuration / 60)} min</span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handlePlayAll(false)}
                    className="px-6 py-2.5 rounded-full font-medium active:scale-95 transition-all flex items-center gap-2 shadow-lg text-sm"
                    style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                  >
                    {isAlbumPlaying && isPlaying ? <><Pause className="h-4 w-4" /> Pause</> : <><Play className="h-4 w-4 ml-0.5" /> Play</>}
                  </button>
                  <button
                    onClick={() => handlePlayAll(true)}
                    className="px-6 py-2.5 border border-border rounded-full font-medium active:scale-95 transition-all flex items-center gap-2 text-sm"
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'hsl(var(--accent))'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
                  >
                    <Shuffle className="h-4 w-4" /> Shuffle
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 max-w-5xl mx-auto pb-6">
        <div className="rounded-xl overflow-hidden">
          <div className="grid grid-cols-[32px_1fr_60px_40px] gap-2 px-4 py-2 text-[10px] font-medium uppercase tracking-wider border-b" style={{ color: 'hsl(var(--muted-foreground))' }}>
            <span className="text-center">#</span>
            <span>Title</span>
            <span className="flex items-center justify-end"><Clock className="h-3.5 w-3.5" /></span>
            <span />
          </div>
          {tracks.map((track, idx) => {
            const isThisPlaying = currentTrack?.id === track.id;
            const contextItems: ContextMenuItem[] = [
              { label: 'Play', icon: <Play className="h-4 w-4" />, onClick: () => playQueue(tracks, idx) },
              { label: 'Play Next', icon: <ListPlus className="h-4 w-4" />, onClick: () => playTrackNext(track) },
              { label: 'Add to Queue', icon: <ListPlus className="h-4 w-4" />, onClick: () => addToQueue([track]) },
              {
                label: 'Instant Mix', icon: <Radio className="h-4 w-4" />, onClick: async () => {
                  const songs = await apiClient.getSimilarSongs(track.id);
                  if (songs.length > 0) playQueue([track, ...songs]);
                }, divider: true
              },
              { label: track.starred ? 'Unstar' : 'Star', icon: <Heart className="h-4 w-4" />, onClick: () => toggleStar(track.id, !!track.starred) },
              ...(track.albumId ? [{ label: 'Go to Album', icon: <Disc className="h-4 w-4" />, onClick: () => navigate(`/album/${track.albumId}`), divider: true }] : []),
              ...(track.artistId ? [{ label: 'Go to Artist', icon: <User className="h-4 w-4" />, onClick: () => navigate(`/artist/${track.artistId}`) }] : []),
            ];

            const { text: artistText, artists: trackArtists } = getArtistDisplay(track);
            const albumArtistName = album?.artist || '';
            const showArtists = trackArtists.length > 0 && artistText !== albumArtistName;

            return (
              <ContextMenu key={track.id} items={contextItems}>
                <div
                  onClick={() => (isThisPlaying && isPlaying ? pause() : playQueue(tracks, idx))}
                  className="grid grid-cols-[32px_1fr_60px_40px] gap-2 px-4 py-2 cursor-pointer group transition-colors"
                  style={{ backgroundColor: isThisPlaying ? 'var(--track-active-bg)' : '' }}
                  onMouseEnter={(e) => { if (!isThisPlaying) e.currentTarget.style.backgroundColor = 'hsl(var(--accent))'; }}
                  onMouseLeave={(e) => { if (!isThisPlaying) e.currentTarget.style.backgroundColor = ''; }}
                >
                  <span className="flex items-center justify-center" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    <span className="group-hover:hidden text-xs tabular-nums">{idx + 1}</span>
                    <span className="hidden group-hover:flex items-center justify-center">
                      {isThisPlaying && isPlaying ? (
                        <Pause className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </span>
                  <div className="min-w-0">
                    <p className={cn('font-medium truncate text-sm', isThisPlaying && 'text-primary')}>
                      {track.title}
                    </p>
                    {showArtists && (
                      <p className="text-xs truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>
                        {trackArtists.map((a, i) => (
                          <span key={a.id || i}>
                            {i > 0 && <span style={{ opacity: 0.5 }}>{', '}</span>}
                            <span
                              className="cursor-pointer transition-all duration-150"
                              onClick={(e) => { e.stopPropagation(); if (a.id) navigate(`/artist/${a.id}`); }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'hsl(var(--foreground))'; (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = ''; (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
                            >{a.name}</span>
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                  <span className="text-right text-xs tabular-nums flex items-center justify-end" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    {formatTime(track.duration || 0)}
                  </span>
                  <div className="flex items-center justify-end">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleStar(track.id, !!track.starred); }}
                      className={cn(
                        'p-1 transition-colors rounded',
                        track.starred ? 'text-primary' : 'text-transparent group-hover:text-muted-foreground hover:!text-primary'
                      )}
                    >
                      <Heart className={cn('h-3.5 w-3.5', track.starred && 'fill-primary')} />
                    </button>
                  </div>
                </div>
              </ContextMenu>
            );
          })}
        </div>
      </div>
    </div>
  );
}
