import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '@/api/client';
import { usePlayerStore, useCacheStore } from '@/stores';
import { useAlbumActions } from '@/hooks';
import type { Track, Album, GetArtistResponse, GetAlbumResponse, ArtistInfo2, ArtistWithAlbumsID3 } from '@/api/types';
import { Play, Pause, Shuffle, ArrowLeft, Music, ExternalLink, ListPlus, Heart, Disc, User, Radio, Download, Share2 } from 'lucide-react';
import { cn, formatTime, getArtistDisplay } from '@/lib/utils';
import { LoadingScreen } from '@/components/ui';
import { ContextMenu, type ContextMenuItem } from '@/components/ContextMenu';
import { usePlatform } from '@/platform';
import { useToastStore } from '@/stores/toastStore';
import { AlbumCard } from '@/components';

export function ArtistScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTrack, isPlaying, playQueue, pause, addToQueue } = usePlayerStore();
  const { getArtist, setArtist } = useCacheStore();
  const { playTrackNext, toggleStar } = useAlbumActions();
  const platform = usePlatform();
  const toast = useToastStore();

  const copyToClipboard = async (text: string) => {
    if (platform.writeClipboard) {
      await platform.writeClipboard(text);
    } else {
      try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
    }
    toast.showToast('Link copied!', 'share');
  };
  const [artist, setArtistState] = useState<ArtistWithAlbumsID3 | null>(null);
  const [artistInfo, setArtistInfo] = useState<ArtistInfo2 | null>(null);
  const [topSongs, setTopSongs] = useState<Track[]>([]);
  const [allTracks, setAllTracks] = useState<Track[]>([]);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const cached = getArtist(id);
    if (cached) {
      setArtistState(cached);
      setLoading(false);
    }

    const load = async () => {
      try {
        const [artistData, infoData] = await Promise.all([
          apiClient.request<GetArtistResponse>('getArtist', { id }),
          apiClient.getArtistInfo2(id),
        ]);
        if (artistData.artist) {
          setArtistState(artistData.artist);
          setArtist(id, artistData.artist);

          const albumIds = artistData.artist.album?.map(a => a.id) || [];
          const albumDetails = await Promise.all(
            albumIds.slice(0, 20).map(albumId =>
              apiClient.request<GetAlbumResponse>('getAlbum', { id: albumId })
                .catch(() => null)
            )
          );
          const tracks = albumDetails
            .flatMap(d => d?.album?.song || []);
          setAllTracks(tracks);
        }
        setArtistInfo(infoData);

        if (artistData.artist?.name) {
          const songs = await apiClient.getTopSongs(artistData.artist.name, 20);
          setTopSongs(songs);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, getArtist, setArtist]);

  const coverUrl = useMemo(() =>
    artist?.coverArt ? apiClient.buildCoverArtUrl(artist.coverArt, 400) : null,
    [artist?.coverArt]
  );

  const headerImageUrl = useMemo(() =>
    artistInfo?.largeImageUrl || artistInfo?.mediumImageUrl || null,
    [artistInfo]
  );

  const isPlayingArtist = currentTrack && allTracks.some(t => t.id === currentTrack.id);

  const handlePlayAll = (shuffleMode = false) => {
    if (allTracks.length === 0) return;
    if (isPlayingArtist && isPlaying) {
      pause();
    } else {
      playQueue(allTracks, shuffleMode ? Math.floor(Math.random() * allTracks.length) : 0);
    }
  };

  const handlePlayTopSongs = (shuffleMode = false) => {
    if (topSongs.length === 0) return;
    playQueue(topSongs, shuffleMode ? Math.floor(Math.random() * topSongs.length) : 0);
  };

  if (loading) return <LoadingScreen />;

  if (!artist) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 animate-fade-in">
        <Music className="h-16 w-16" style={{ color: 'hsl(var(--muted-foreground))', opacity: 0.3 }} />
        <div style={{ color: 'hsl(var(--muted-foreground))' }} className="text-sm">Artist not found</div>
        <button onClick={() => navigate(-1)} className="text-sm text-primary hover:underline">Go back</button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="relative overflow-hidden">
        {headerImageUrl && (
          <>
            <div className="absolute inset-0 bg-cover bg-center scale-110" style={{ backgroundImage: `url(${headerImageUrl})`, filter: 'blur(4px)', opacity: 0.3 }} />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent, hsl(var(--background)))' }} />
          </>
        )}
        <div className="relative p-6 max-w-6xl mx-auto">
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

          <div className="flex gap-6 mb-8 items-end">
            <div className="w-44 h-44 flex-shrink-0 rounded-full overflow-hidden bg-muted shadow-2xl">
              {coverUrl ? (
                <img src={coverUrl} alt={artist.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, var(--album-header-bg), var(--cover-placeholder-bg))' }}>
                  <Music className="h-16 w-16" style={{ color: 'hsl(var(--primary))', opacity: 0.3 }} />
                </div>
              )}
            </div>
            <div className="flex flex-col justify-end min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>Artist</p>
              <h1 className="text-4xl font-bold mb-2 truncate">{artist.name}</h1>
              <p className="text-sm mb-4" style={{ color: 'hsl(var(--muted-foreground))' }}>
                {artist.albumCount || 0} albums
                {allTracks.length > 0 && <span style={{ opacity: 0.5 }}> &middot; {allTracks.length} songs</span>}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handlePlayAll(false)}
                  disabled={allTracks.length === 0}
                  className={cn(
                    'px-6 py-2.5 rounded-full font-medium active:scale-95 transition-all flex items-center gap-2 shadow-lg text-sm',
                  )}
                  style={{
                    backgroundColor: 'hsl(var(--primary))',
                    color: 'hsl(var(--primary-foreground))',
                    opacity: allTracks.length === 0 ? 0.5 : 1,
                    cursor: allTracks.length === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isPlayingArtist && isPlaying ? <><Pause className="h-4 w-4" /> Pause</> : <><Play className="h-4 w-4 ml-0.5" /> Play</>}
                </button>
                <button
                  onClick={() => handlePlayAll(true)}
                  disabled={allTracks.length === 0}
                  className="px-6 py-2.5 border border-border rounded-full font-medium active:scale-95 transition-all flex items-center gap-2 text-sm"
                  style={{
                    opacity: allTracks.length === 0 ? 0.5 : 1,
                    cursor: allTracks.length === 0 ? 'not-allowed' : 'pointer',
                  }}
                  onMouseEnter={(e) => { if (allTracks.length > 0) e.currentTarget.style.backgroundColor = 'hsl(var(--accent))'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
                >
                  <Shuffle className="h-4 w-4" /> Shuffle
                </button>
              </div>
            </div>
          </div>

          {artistInfo?.biography && (() => {
            const cleaned = artistInfo.biography
              .replace(/<a\s+href="[^"]*">Read more on Last\.fm<\/a>\.?/gi, '')
              .replace(/<[^>]*>/g, '')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#039;/g, "'")
              .replace(/&nbsp;/g, ' ')
              .trim();
            if (!cleaned) return null;
            return (
              <div className="mb-6 max-w-2xl">
                <p
                  className={cn('text-sm leading-relaxed', !bioExpanded && 'line-clamp-3')}
                  style={{ color: 'hsl(var(--muted-foreground))' }}
                >{cleaned}</p>
                <div className="flex items-center gap-3 mt-2">
                  {cleaned.length > 200 && (
                    <button
                      onClick={() => setBioExpanded(!bioExpanded)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {bioExpanded ? 'Show less' : 'Read more'}
                    </button>
                  )}
                  {artistInfo.lastFmUrl && (
                    <a
                      href={artistInfo.lastFmUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                    >
                      View on Last.fm <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {topSongs.length > 0 && (
        <div className="px-6 max-w-6xl mx-auto pb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Top Songs</h2>
            <div className="flex gap-2">
              <button
                onClick={() => handlePlayTopSongs(false)}
                className="px-4 py-1.5 rounded-full text-xs font-medium active:scale-95 transition-all flex items-center gap-1.5"
                style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
              >
                <Play className="h-3 w-3" /> Play
              </button>
              <button
                onClick={() => handlePlayTopSongs(true)}
                className="px-4 py-1.5 rounded-full text-xs font-medium border border-border active:scale-95 transition-all flex items-center gap-1.5"
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'hsl(var(--accent))'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
              >
                <Shuffle className="h-3 w-3" /> Shuffle
              </button>
            </div>
          </div>
          <div className="rounded-xl overflow-hidden">
            {topSongs.slice(0, 10).map((track, idx) => {
              const isThisPlaying = currentTrack?.id === track.id;
              const contextItems: ContextMenuItem[] = [
                { label: 'Play', icon: <Play className="h-4 w-4" />, onClick: () => playQueue(topSongs, idx) },
                { label: 'Play Next', icon: <ListPlus className="h-4 w-4" />, onClick: () => playTrackNext(track) },
                { label: 'Add to Queue', icon: <ListPlus className="h-4 w-4" />, onClick: () => addToQueue([track]) },
                { label: 'Instant Mix', icon: <Radio className="h-4 w-4" />, onClick: async () => {
                  const songs = await apiClient.getSimilarSongs(track.id);
                  if (songs.length > 0) playQueue([track, ...songs]);
                }, divider: true },
                { label: track.starred ? 'Unstar' : 'Star', icon: <Heart className="h-4 w-4" />, onClick: () => toggleStar(track.id, !!track.starred), divider: true },
                { label: 'Download', icon: <Download className="h-4 w-4" />, onClick: () => apiClient.downloadTrack(track).catch(() => { /* ignore */ }) },
                { label: 'Share', icon: <Share2 className="h-4 w-4" />, onClick: async () => {
                  const shareEnabled = (() => { try { const v = localStorage.getItem('dino_shares'); return v ? JSON.parse(v) : true; } catch { return true; } })();
                  if (!shareEnabled) return;
                  const share = await apiClient.createShare([track.id], `${track.title} - ${getArtistDisplay(track).text || 'Unknown Artist'}`);
                  if (share?.url) await copyToClipboard(share.url);
                } },
                ...(track.albumId ? [{ label: 'Go to Album', icon: <Disc className="h-4 w-4" />, onClick: () => navigate(`/album/${track.albumId}`), divider: true }] : []),
              ];

              return (
                <ContextMenu key={track.id} items={contextItems}>
                  <div
                    onClick={() => (isThisPlaying && isPlaying ? pause() : playQueue(topSongs, idx))}
                    className="grid grid-cols-[32px_1fr_80px_40px] gap-2 px-4 py-2 cursor-pointer group transition-colors"
                    style={{ backgroundColor: isThisPlaying ? 'var(--track-active-bg)' : '' }}
                    onMouseEnter={(e) => { if (!isThisPlaying) e.currentTarget.style.backgroundColor = 'hsl(var(--accent))'; }}
                    onMouseLeave={(e) => { if (!isThisPlaying) e.currentTarget.style.backgroundColor = ''; }}
                  >
                    <span className="flex items-center justify-center" style={{ color: 'hsl(var(--muted-foreground))' }}>
                      <span className="group-hover:hidden text-xs tabular-nums">{idx + 1}</span>
                      <span className="hidden group-hover:flex items-center justify-center">
                        {isThisPlaying && isPlaying ? <Pause className="h-3.5 w-3.5 text-primary" /> : <Play className="h-3.5 w-3.5" />}
                      </span>
                    </span>
                    <div className="min-w-0 flex items-center gap-3">
                      <div className="h-9 w-9 rounded overflow-hidden flex-shrink-0 bg-muted">
                        {track.coverArt ? <img src={apiClient.buildCoverArtUrl(track.coverArt, 60)} alt={track.title} className="w-full h-full object-cover" /> : <Music className="h-4 w-4 m-auto mt-2.5" style={{ color: 'hsl(var(--muted-foreground))' }} />}
                      </div>
                      <div className="min-w-0">
                        <p className={cn('font-medium truncate text-sm', isThisPlaying && 'text-primary')}>{track.title}</p>
                        <p className="text-xs truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>
                          {getArtistDisplay(track).text || track.artist}
                        </p>
                      </div>
                    </div>
                    <span className="text-right text-xs tabular-nums flex items-center justify-end" style={{ color: 'hsl(var(--muted-foreground))' }}>
                      {formatTime(track.duration || 0)}
                    </span>
                    <div className="flex items-center justify-end">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleStar(track.id, !!track.starred); }}
                        className={cn('p-1 transition-colors rounded', track.starred ? 'text-primary' : 'text-transparent group-hover:text-muted-foreground hover:!text-primary')}
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
      )}

      {artistInfo?.similarArtist && artistInfo.similarArtist.length > 0 && (
        <div className="px-6 max-w-6xl mx-auto pb-6">
          <h2 className="text-xl font-semibold mb-4">Similar Artists</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
            {artistInfo.similarArtist.map((a) => {
              const aCoverUrl = a.coverArt ? apiClient.buildCoverArtUrl(a.coverArt, 300) : null;
              return (
                <div
                  key={a.id}
                  onClick={() => navigate(`/artist/${a.id}`)}
                  className="group cursor-pointer p-1.5 rounded-lg active:scale-[0.98] transition-all duration-200"
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'hsl(var(--accent))'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
                >
                  <div className="relative aspect-square rounded-md overflow-hidden bg-muted mb-1.5 shadow-md">
                    {aCoverUrl ? (
                      <img src={aCoverUrl} alt={a.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, var(--track-active-bg), var(--cover-placeholder-bg))' }}>
                        <User className="h-8 w-8" style={{ color: 'hsl(var(--muted-foreground))', opacity: 0.3 }} />
                      </div>
                    )}
                  </div>
                  <h3 className="font-medium truncate text-xs leading-tight">{a.name}</h3>
                  {a.albumCount !== undefined && (
                    <p className="text-xs truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>{a.albumCount} albums</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="px-6 max-w-6xl mx-auto pb-6">
        <h2 className="text-xl font-semibold mb-4">Albums</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
          {artist.album?.map((album: Album) => (
            <AlbumCard key={album.id} album={album} />
          ))}
        </div>
      </div>
    </div>
  );
}
