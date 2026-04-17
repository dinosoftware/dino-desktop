import type { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePlayerStore, useUpdateStore } from '@/stores';
import { cn, formatTime, getArtistDisplay } from '@/lib/utils';
import {
  Home,
  Library,
  Search,
  Heart,
  ListMusic,
  Settings,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Shuffle,
  Volume2,
  VolumeX,
  Music,
  ChevronDown,
  List,
  Mic2,
  Trash2,
  Disc,
  User,
  X,
  ListPlus,
  Maximize2,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  Download,
  Upload,
  MoreVertical,
  GripVertical,
} from 'lucide-react';
import { apiClient } from '@/api/client';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ContextMenu, type ContextMenuItem } from '@/components/ContextMenu';
import { AudioVisualizer } from '@/components/AudioVisualizer';
import type { StructuredLyrics, Track } from '@/api/types';
import { useAlbumActions } from '@/hooks/useAlbumActions';
import { usePlatform } from '@/platform';

interface AppLayoutProps {
  children: ReactNode;
}

type FullPlayerTab = 'queue' | 'lyrics';
type PlayerMode = 'mini' | 'expanded' | 'fullscreen';

const INACTIVITY_TIMEOUT = 3000;

function formatCodecName(suffix: string): string {
  const map: Record<string, string> = { mp3: 'MP3', opus: 'Opus', aac: 'AAC', flac: 'FLAC', ogg: 'OGG', wav: 'WAV', m4a: 'M4A', alac: 'ALAC', ape: 'APE', wma: 'WMA' };
  return map[suffix.toLowerCase()] || suffix.toUpperCase();
}

function getStreamDisplay(track: Track | null): string {
  if (!track) return '';
  const suffix = track.suffix || (track.contentType ? track.contentType.split('/')[1] : '') || '';
  const fmt = suffix ? formatCodecName(suffix) : '';
  const br = track.bitRate;
  if (br && fmt) return `${br} kbps ${fmt}`;
  if (fmt) return fmt;
  if (br) return `${br} kbps`;
  return '';
}

function useQualityBadge(track: Track | null): { text: string; simple: string; toggleDetail: () => void } {
  const [detailed, setDetailed] = useState(false);

  const quality = localStorage.getItem('dino_quality');
  let qualityValue = '0';
  try { if (quality) qualityValue = JSON.parse(quality); } catch {}

  const simpleLabel = qualityValue === '0' || qualityValue === 'max' ? 'MAX'
    : parseInt(qualityValue) >= 256 ? 'HIGH'
    : parseInt(qualityValue) >= 128 ? 'MED'
    : 'LOW';

  const streamInfo = getStreamDisplay(track);

  const detailedText = qualityValue === '0' || qualityValue === 'max'
    ? (streamInfo || 'MAX')
    : (streamInfo || `${qualityValue} kbps`);

  const toggleDetail = () => setDetailed(d => !d);

  return {
    text: detailed ? detailedText : simpleLabel,
    simple: simpleLabel,
    toggleDetail,
  };
}

function ArtistLink({ track, onNavigate, fs }: { track: Track; onNavigate: () => void; fs: boolean }) {
  const { text, artists } = getArtistDisplay(track);
  const navigate = useNavigate();
  const artistColor = fs ? 'hsl(var(--foreground))' : '';
  const [artistCovers, setArtistCovers] = useState<Record<string, string>>({});
  const fetchedRef = useRef(false);

  const withId = artists.filter(a => a.id);

  useEffect(() => {
    if (fetchedRef.current || withId.length <= 1) return;
    fetchedRef.current = true;
    let alive = true;
    Promise.all(
      withId.map(a => apiClient.getArtist(a.id!).then(r => r?.coverArt ? [a.id!, r.coverArt] as const : null).catch(() => null))
    ).then(results => {
      if (!alive) return;
      const map: Record<string, string> = {};
      for (const r of results) { if (r) map[r[0]] = r[1]; }
      setArtistCovers(map);
    });
    return () => { alive = false; };
  }, [withId.length]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (withId.length === 0) return;
    if (withId.length === 1) {
      navigate(`/artist/${withId[0].id}`);
      onNavigate();
    }
  };

  if (withId.length <= 1) {
    const single = withId[0];
    return (
      <MarqueeText className="text-xs sm:text-sm" style={{ color: artistColor, opacity: 0.6 }}>
        <span
          onClick={single ? handleClick : undefined}
          className={single ? 'cursor-pointer transition-all duration-150' : undefined}
          onMouseEnter={(e) => { if (single) { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; } }}
          onMouseLeave={(e) => { if (single) { (e.currentTarget as HTMLElement).style.opacity = '0.6'; (e.currentTarget as HTMLElement).style.textDecoration = 'none'; } }}
        >
          {text}
        </span>
      </MarqueeText>
    );
  }

  const items: ContextMenuItem[] = withId.map(a => ({
    label: a.name,
    icon: artistCovers[a.id!] ? (
      <img src={apiClient.buildCoverArtUrl(artistCovers[a.id!], 40)} alt="" className="w-[18px] h-[18px] rounded-full object-cover" />
    ) : (
      <User className="h-4 w-4" />
    ),
    onClick: () => { navigate(`/artist/${a.id}`); onNavigate(); },
  }));

  return (
    <ContextMenu items={items} trigger="click">
      <MarqueeText className="text-xs sm:text-sm" style={{ color: artistColor, opacity: 0.6 }}>
        <span
          className="cursor-pointer transition-all duration-150"
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.6'; (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
        >
          {text}
        </span>
      </MarqueeText>
    </ContextMenu>
  );
}

function MarqueeText({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const innerRef = useRef<HTMLSpanElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const [needsMarquee, setNeedsMarquee] = useState(false);

  useEffect(() => {
    if (innerRef.current && outerRef.current) {
      setNeedsMarquee(innerRef.current.scrollWidth > outerRef.current.clientWidth + 2);
    }
  }, [children]);

  if (!needsMarquee) {
    return (
      <div ref={outerRef} className={className} style={{ overflow: 'hidden', ...style }}>
        <span ref={innerRef} className="truncate block">{children}</span>
      </div>
    );
  }

  return (
    <div ref={outerRef} className={className} style={{ overflow: 'hidden', ...style }}>
      <div className="inline-flex" style={{ animation: 'marquee 15s linear infinite' }}>
        <span ref={innerRef} className="whitespace-nowrap">{children}</span>
        <span className="whitespace-nowrap" style={{ paddingLeft: '3em' }}>{children}</span>
      </div>
    </div>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const platform = usePlatform();
  const analyser = platform.getAnalyser();
  const {
    currentTrack,
    isPlaying,
    pause,
    resume,
    next,
    previous,
    position,
    duration,
    seek,
    volume,
    setVolume,
    repeat,
    toggleRepeat,
    shuffle,
    toggleShuffle,
    queue,
    playQueue,
    clearQueue,
    removeFromQueue,
    loadQueueFromServer,
    buffered,
  } = usePlayerStore();
  const updateStatus = useUpdateStore((s) => s.status);

  const qualityBadge = useQualityBadge(currentTrack);

  const [playerMode, setPlayerMode] = useState<PlayerMode>('mini');
  const [showQueue, setShowQueue] = useState(false);
  const [fullPlayerTab, setFullPlayerTab] = useState<FullPlayerTab>('queue');
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [lyrics, setLyrics] = useState<StructuredLyrics[]>([]);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [userInteracting, setUserInteracting] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);
  const [dropdownDragIdx, setDropdownDragIdx] = useState<number | null>(null);
  const [dropdownDragOverIdx, setDropdownDragOverIdx] = useState<number | null>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsVisibleRef = useRef(true);
  const lyricsRef = useRef<HTMLDivElement>(null);
  const fullPlayerRef = useRef<HTMLDivElement>(null);
  const dropdownQueueRef = useRef<HTMLDivElement>(null);

  const progress = duration > 0 ? (position / duration) * 100 : 0;
  const displayProgress = isSeeking ? (seekValue / (duration || 1)) * 100 : progress;

  const coverArtUrl = currentTrack?.coverArt ? apiClient.buildCoverArtUrl(currentTrack.coverArt, 800) : null;
  const miniCoverUrl = currentTrack?.coverArt ? apiClient.buildCoverArtUrl(currentTrack.coverArt, 120) : null;
  const fullPlayerCoverUrl = currentTrack?.coverArt ? apiClient.buildCoverArtUrl(currentTrack.coverArt, 600) : null;
  const sidebarCoverUrl = currentTrack?.coverArt ? apiClient.buildCoverArtUrl(currentTrack.coverArt, 200) : null;

  const [displayedBgCoverUrl, setDisplayedBgCoverUrl] = useState<string | null>(null);
  useEffect(() => {
    if (coverArtUrl) {
      const img = new Image();
      img.onload = () => setDisplayedBgCoverUrl(coverArtUrl);
      img.src = coverArtUrl;
    } else {
      setDisplayedBgCoverUrl(null);
    }
  }, [coverArtUrl]);

  const bufferedPercent = duration > 0 ? (buffered / duration) * 100 : 0;

  const activeLyricIndex = useMemo(() => {
    if (lyrics.length === 0 || !lyrics[0]?.synced) return -1;
    const synced = lyrics[0];
    if (!synced.line) return -1;
    const posMs = position * 1000;
    for (let i = synced.line.length - 1; i >= 0; i--) {
      if (synced.line[i].start !== undefined && posMs >= synced.line[i].start!) {
        return i;
      }
    }
    return -1;
  }, [position, lyrics]);

  useEffect(() => {
    const onResize = () => {
      setWindowWidth(window.innerWidth);
      setWindowHeight(window.innerHeight);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const sidebarHideCover = windowHeight < 680;
  const compactExpanded = windowHeight < 580 || (windowHeight < 700 && windowWidth < 900);

  const fetchingLyricsForId = useRef<string | null>(null);

  useEffect(() => {
    if (playerMode !== 'mini' && currentTrack) {
      if (fetchingLyricsForId.current === currentTrack.id && lyrics.length > 0) return;
      fetchingLyricsForId.current = currentTrack.id;
      setLyrics([]);
      setLyricsLoading(true);
      apiClient.getLyricsBySongId(currentTrack.id).then((data) => {
        if (fetchingLyricsForId.current === currentTrack.id) {
          setLyrics(data);
          setLyricsLoading(false);
        }
      }).catch(() => {
        if (fetchingLyricsForId.current === currentTrack.id) {
          setLyrics([]);
          setLyricsLoading(false);
        }
      });
    }
  }, [playerMode, currentTrack]);

  useEffect(() => {
    if (activeLyricIndex >= 0 && lyricsRef.current) {
      const el = lyricsRef.current.querySelector(`[data-lyric-idx="${activeLyricIndex}"]`);
      if (el) {
        const container = lyricsRef.current;
        const top = (el as HTMLElement).offsetTop - container.offsetTop - 60;
        container.scrollTo({ top, behavior: 'smooth' });
      }
    }
  }, [activeLyricIndex]);

  const scrollToCurrentTrack = useCallback((container: HTMLElement | null) => {
    if (!container || !currentTrack) return;
    const el = container.querySelector(`[data-queue-id="${currentTrack.id}"]`);
    if (el) {
      const top = (el as HTMLElement).offsetTop - container.offsetTop - 60;
      container.scrollTo({ top, behavior: 'smooth' });
    }
  }, [currentTrack]);

  useEffect(() => {
    if (showQueue && playerMode === 'mini' && queue.length > 0) {
      requestAnimationFrame(() => scrollToCurrentTrack(dropdownQueueRef.current));
    }
  }, [showQueue, playerMode, queue.length, scrollToCurrentTrack]);

  const panelQueueContainerRef = useRef<HTMLDivElement | null>(null);
  const panelQueueScrollRef = useCallback((el: HTMLDivElement | null) => {
    panelQueueContainerRef.current = el;
    if (el) {
      requestAnimationFrame(() => scrollToCurrentTrack(el));
    }
  }, [scrollToCurrentTrack]);

  useEffect(() => {
    if (fullPlayerTab === 'queue' && panelQueueContainerRef.current) {
      requestAnimationFrame(() => scrollToCurrentTrack(panelQueueContainerRef.current));
    }
  }, [fullPlayerTab, scrollToCurrentTrack]);

  useEffect(() => {
    if (playerMode === 'fullscreen' && fullPlayerRef.current) {
      const el = fullPlayerRef.current;
      if (el.requestFullscreen && !document.fullscreenElement) {
        el.requestFullscreen().catch(() => {});
      }
    }
  }, [playerMode]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && playerMode === 'fullscreen') {
        setPlayerMode('expanded');
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [playerMode]);

  useEffect(() => {
    if (playerMode === 'mini') {
      return;
    }

    const show = () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      controlsVisibleRef.current = true;
      setControlsVisible(true);
      inactivityTimerRef.current = setTimeout(() => {
        if (!userInteracting) {
          controlsVisibleRef.current = false;
          setControlsVisible(false);
        }
      }, INACTIVITY_TIMEOUT);
    };

    const handleMouseMove = () => show();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      show();
    };

    handleMouseMove();

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [playerMode, userInteracting]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') {
        if (playerMode === 'fullscreen') {
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          }
          setPlayerMode('expanded');
          return;
        }
        if (playerMode === 'expanded') {
          setPlayerMode('mini');
          setShowQueue(false);
          return;
        }
      }
      if (e.key === 'f' && playerMode !== 'mini') {
        e.preventDefault();
        setPlayerMode(playerMode === 'fullscreen' ? 'expanded' : 'fullscreen');
        return;
      }
      if (e.key === ' ' && playerMode === 'mini') {
        e.preventDefault();
        if (currentTrack) {
          if (isPlaying) { pause(); } else { resume(); }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playerMode, currentTrack, isPlaying, pause, resume]);

  const handleSeekStart = () => {
    setIsSeeking(true);
    setSeekValue(position);
    setUserInteracting(true);
  };

  const handleSeekChange = (value: number) => {
    setSeekValue(value);
  };

  const handleSeekEnd = (value: number) => {
    setIsSeeking(false);
    seek(value);
    setUserInteracting(false);
  };

  const handleVolumeStart = () => setUserInteracting(true);
  const handleVolumeEnd = () => setUserInteracting(false);

  const handlePlayFromQueue = (index: number) => {
    playQueue(queue, index);
  };

  const currentIndex = useMemo(() => {
    if (!currentTrack) return -1;
    return queue.findIndex(t => t.id === currentTrack.id);
  }, [currentTrack, queue]);

  const upcomingQueue = useMemo(() => {
    if (currentIndex < 0) return queue;
    return queue.slice(currentIndex + 1);
  }, [queue, currentIndex]);

  const navItems = [
    { id: '/', icon: Home, label: 'Home' },
    { id: '/library', icon: Library, label: 'Library' },
    { id: '/search', icon: Search, label: 'Search' },
    { id: '/favorites', icon: Heart, label: 'Favorites' },
    { id: '/playlists', icon: ListMusic, label: 'Playlists' },
  ];

  const getQueueContextItems = (track: typeof queue[0], idx: number): ContextMenuItem[] => [
    { label: 'Play', icon: <Play className="h-4 w-4" />, onClick: () => handlePlayFromQueue(idx) },
    { label: 'Play Next', icon: <ListPlus className="h-4 w-4" />, onClick: () => usePlayerStore.getState().addNext([track]) },
    { label: 'Remove from Queue', icon: <X className="h-4 w-4" />, onClick: () => removeFromQueue(idx), danger: true, divider: true },
    { label: 'Instant Mix', icon: <Radio className="h-4 w-4" />, onClick: async () => {
      const songs = await apiClient.getSimilarSongs(track.id);
      if (songs.length > 0) usePlayerStore.getState().playQueue([track, ...songs]);
    } },
    ...(track.albumId ? [{ label: 'Go to Album', icon: <Disc className="h-4 w-4" />, onClick: () => { navigate(`/album/${track.albumId}`); if (playerMode !== 'mini') setPlayerMode('mini'); }, divider: true }] : []),
    ...(track.artistId ? [{ label: 'Go to Artist', icon: <User className="h-4 w-4" />, onClick: () => { navigate(`/artist/${track.artistId}`); if (playerMode !== 'mini') setPlayerMode('mini'); } }] : []),
  ];

  const { toggleStar } = useAlbumActions();

  const getCurrentTrackContextItems = useCallback((): ContextMenuItem[] => {
    if (!currentTrack) return [];
    return [
      { label: 'Play Next', icon: <ListPlus className="h-4 w-4" />, onClick: () => usePlayerStore.getState().addNext([currentTrack]) },
      { label: 'Add to Queue', icon: <ListPlus className="h-4 w-4" />, onClick: () => usePlayerStore.getState().addToQueue([currentTrack]) },
      { label: 'Instant Mix', icon: <Radio className="h-4 w-4" />, onClick: async () => {
        const songs = await apiClient.getSimilarSongs(currentTrack.id);
        if (songs.length > 0) usePlayerStore.getState().playQueue([currentTrack, ...songs]);
      }, divider: true },
      { label: currentTrack.starred ? 'Unstar' : 'Star', icon: <Heart className="h-4 w-4" />, onClick: () => toggleStar(currentTrack.id, !!currentTrack.starred) },
      ...(currentTrack.albumId ? [{ label: 'Go to Album', icon: <Disc className="h-4 w-4" />, onClick: () => { navigate(`/album/${currentTrack.albumId}`); if (playerMode !== 'mini') setPlayerMode('mini'); }, divider: true }] : []),
      ...(currentTrack.artistId ? [{ label: 'Go to Artist', icon: <User className="h-4 w-4" />, onClick: () => { navigate(`/artist/${currentTrack.artistId}`); if (playerMode !== 'mini') setPlayerMode('mini'); } }] : []),
    ];
  }, [currentTrack, navigate, toggleStar, playerMode]);

  const isPlayerOpen = playerMode !== 'mini';

  return (
    <div className="flex h-screen bg-background">
      <aside className={cn(
        'bg-card flex flex-col transition-all duration-300 flex-shrink-0',
        sidebarCollapsed ? 'w-14' : 'w-60',
        isPlayerOpen && 'hidden',
        !isPlayerOpen && 'border-r border-border'
      )} style={{ height: isPlayerOpen ? '100vh' : 'calc(100vh - 80px)' }}>
        <div className={cn('border-b border-border flex items-center', sidebarCollapsed ? 'p-2 justify-center' : 'p-4 justify-between')}>
          <div className="flex items-center gap-2.5">
            <img src="./icon.png" alt="Dino" className={cn('rounded-lg', sidebarCollapsed ? 'w-7 h-7' : 'w-8 h-8')} />
            {!sidebarCollapsed && <h1 className="text-xl font-bold tracking-tight">Dino</h1>}
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: 'hsl(var(--muted-foreground))' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'hsl(var(--foreground))'; e.currentTarget.style.backgroundColor = 'hsl(var(--accent))'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'hsl(var(--muted-foreground))'; e.currentTarget.style.backgroundColor = ''; }}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto scrollbar-none">
          {navItems.map((item) => {
            const isActive = location.pathname === item.id ||
              (item.id !== '/' && location.pathname.startsWith(item.id));
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                className={cn(
                  'w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-200',
                  sidebarCollapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5',
                )}
                style={{
                  backgroundColor: isActive ? 'hsl(var(--accent))' : '',
                  color: isActive ? 'hsl(var(--accent-foreground))' : 'hsl(var(--muted-foreground))',
                }}
                onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.color = 'hsl(var(--foreground))'; e.currentTarget.style.backgroundColor = 'hsl(var(--accent))'; e.currentTarget.style.transform = 'scale(0.98)'; } }}
                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.color = 'hsl(var(--muted-foreground))'; e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.transform = ''; } }}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!sidebarCollapsed && item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-2 border-t border-border">
          <button
            onClick={() => navigate('/settings')}
            title={sidebarCollapsed ? 'Settings' : undefined}
            className={cn(
              'w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-200',
              sidebarCollapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5',
            )}
            style={{
              backgroundColor: location.pathname === '/settings' ? 'hsl(var(--accent))' : '',
              color: location.pathname === '/settings' ? 'hsl(var(--accent-foreground))' : 'hsl(var(--muted-foreground))',
            }}
            onMouseEnter={(e) => { if (location.pathname !== '/settings') { e.currentTarget.style.color = 'hsl(var(--foreground))'; e.currentTarget.style.backgroundColor = 'hsl(var(--accent))'; e.currentTarget.style.transform = 'scale(0.98)'; } }}
            onMouseLeave={(e) => { if (location.pathname !== '/settings') { e.currentTarget.style.color = 'hsl(var(--muted-foreground))'; e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.transform = ''; } }}
          >
            <div className="relative">
              <Settings className="h-5 w-5 flex-shrink-0" />
              {platform.isDesktop && (updateStatus === 'available' || updateStatus === 'downloaded') && (
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--toggle-on)' }} />
              )}
            </div>
            {!sidebarCollapsed && (
              <span className="flex items-center gap-2">
                Settings
                {platform.isDesktop && (updateStatus === 'available' || updateStatus === 'downloaded') && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--toggle-on)', color: 'var(--toggle-on-knob)' }}>
                    {updateStatus === 'downloaded' ? 'Ready' : 'Update'}
                  </span>
                )}
              </span>
            )}
          </button>
        </div>

        {!sidebarCollapsed && currentTrack && !sidebarHideCover && (
          <div className="px-3 pb-3 pt-1">
            <div
              onClick={() => setPlayerMode('expanded')}
              className="cursor-pointer rounded-xl overflow-hidden transition-all"
              onMouseEnter={(e) => { e.currentTarget.style.outline = '2px solid var(--cover-ring)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.outline = ''; }}
            >
              <div className="w-full bg-muted flex items-center justify-center" style={{ aspectRatio: '1/1' }}>
                {sidebarCoverUrl ? (
                  <img src={sidebarCoverUrl} alt={currentTrack.title} className="w-full h-full object-cover" />
                ) : (
                  <Music className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* EXPANDED PLAYER */}
      {playerMode === 'expanded' && currentTrack && (
        <div className="fixed inset-0 z-40 flex flex-col animate-fade-in">
          {displayedBgCoverUrl ? (
            <>
              <div className="absolute inset-0 bg-cover bg-center scale-125" style={{ backgroundImage: `url(${displayedBgCoverUrl})`, filter: 'blur(20px)' }} />
              <div className="absolute inset-0" style={{ backgroundColor: 'var(--player-overlay)' }} />
            </>
          ) : (
            <div className="absolute inset-0 bg-background" />
          )}

          <div className="relative z-10 flex items-center justify-between p-4">
            <button
              onClick={() => setPlayerMode('mini')}
              className="flex items-center gap-2 transition-colors px-2 py-1.5 rounded-md text-sm"
              style={{ color: 'hsl(var(--foreground))', opacity: 0.7 }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.backgroundColor = 'var(--hover-highlight)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.backgroundColor = ''; }}
            >
              <ChevronDown className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-1">
              <ContextMenu items={getCurrentTrackContextItems()} trigger="click">
                <button
                  className="p-1.5 transition-colors rounded-md"
                  style={{ color: 'hsl(var(--foreground))', opacity: 0.7 }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.backgroundColor = 'var(--hover-highlight)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.backgroundColor = ''; }}
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </ContextMenu>
              <button
                onClick={() => setPlayerMode('fullscreen')}
                className="p-1.5 transition-colors rounded-md"
                style={{ color: 'hsl(var(--foreground))', opacity: 0.7 }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.backgroundColor = 'var(--hover-highlight)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.backgroundColor = ''; }}
                title="Fullscreen (F)"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className={cn("relative z-10 flex-1 flex min-h-0 px-4 sm:px-6 pb-4 sm:pb-6", compactExpanded ? "flex-row gap-4" : "flex-col lg:flex-row")}>
            <div className={cn("flex flex-col items-center justify-center", compactExpanded ? "w-auto flex-shrink-0 py-2" : "flex-1 lg:w-1/2 py-2 lg:py-0")}>
              <div className={cn("rounded-2xl shadow-2xl overflow-hidden flex-shrink-0", compactExpanded ? "w-28 h-28 mb-2" : "w-36 h-36 sm:w-48 sm:h-48 md:w-56 md:h-56 lg:w-64 lg:h-64 xl:w-80 xl:h-80 2xl:w-96 2xl:h-96 mb-4 lg:mb-6")} style={{ backgroundColor: 'var(--cover-container-bg)' }}>
                {fullPlayerCoverUrl ? (
                  <img src={fullPlayerCoverUrl} alt={currentTrack.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ color: 'hsl(var(--foreground))', opacity: 0.2 }}>
                    <Music className="h-16 w-16" />
                  </div>
                )}
              </div>

              <div className="text-center mb-4 lg:mb-6 w-full max-w-xs xl:max-w-sm 2xl:max-w-md mx-auto">
                <MarqueeText className="text-lg sm:text-xl xl:text-2xl font-bold mb-1">{currentTrack.title}</MarqueeText>
                <ArtistLink track={currentTrack} onNavigate={() => setPlayerMode('mini')} fs={false} />
                {currentTrack.album && (
                  <MarqueeText className="text-xs sm:text-sm mt-0.5">
                    <span
                      onClick={(e) => { e.stopPropagation(); if (currentTrack.albumId) { navigate(`/album/${currentTrack.albumId}`); setPlayerMode('mini'); } }}
                      className="cursor-pointer transition-all duration-150"
                      style={{ color: 'hsl(var(--foreground))', opacity: 0.5 }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.5'; (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
                    >{currentTrack.album}</span>
                  </MarqueeText>
                )}
              </div>

              <div className="w-full max-w-xs xl:max-w-sm 2xl:max-w-md mx-auto mb-4 lg:mb-6">
                <SliderBar
                  value={isSeeking ? seekValue : position}
                  max={duration || 1}
                  displayPercent={displayProgress}
                  onChange={handleSeekChange}
                  onStart={handleSeekStart}
                  onEnd={handleSeekEnd}
                  height="h-1.5"
                  trackColor="var(--slider-track)"
                  fillColor="var(--slider-fill)"
                  thumbColor="var(--slider-fill-strong)"
                  bufferPercent={bufferedPercent}
                />
                <div className="flex justify-between items-center text-[11px] mt-2" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)', color: 'var(--toggle-off-knob)' }}>
                   <span className="tabular-nums">{formatTime(isSeeking ? seekValue : position)}</span>
                    <span onClick={(e) => { e.stopPropagation(); qualityBadge.toggleDetail(); }} className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide cursor-pointer hover:opacity-80 transition-opacity" style={{ border: '1px solid currentColor', textShadow: 'none' }}>{qualityBadge.text}</span>
                    <span className="tabular-nums">{formatTime(duration)}</span>
                   </div>
              </div>

              <div className="flex items-center gap-3 sm:gap-4 xl:gap-5 mb-4">
                <ControlButton onClick={toggleShuffle} active={shuffle} icon={<Shuffle className="h-5 w-5" />} size="lg" />
                <ControlButton onClick={previous} icon={<SkipBack className="h-5 w-5 sm:h-6 sm:w-6" />} size="lg" />
                <button
                  onClick={() => isPlaying ? pause() : resume()}
                  className="h-12 w-12 sm:h-14 sm:w-14 xl:h-16 xl:w-16 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95"
                  style={{ backgroundColor: 'var(--toggle-on)', color: 'var(--toggle-on-knob)', boxShadow: '0 4px 14px rgba(0,0,0,0.3)' }}
                >
                  {isPlaying ? <Pause className="h-5 w-5 sm:h-6 sm:w-6" /> : <Play className="h-5 w-5 sm:h-6 sm:w-6 ml-0.5" />}
                </button>
                <ControlButton onClick={next} icon={<SkipForward className="h-5 w-5 sm:h-6 sm:w-6" />} size="lg" />
                <ControlButton
                  onClick={toggleRepeat}
                  active={repeat !== 'off'}
                  icon={
                    <span className="relative">
                      <Repeat className="h-5 w-5" />
                      {repeat === 'one' && <span className="absolute -top-1 -right-1 text-[8px] font-black" style={{ color: 'var(--toggle-on-knob)' }}>1</span>}
                    </span>
                  }
                   size="lg"
                 />
              </div>

              <div className="flex items-center gap-2.5">
                <button onClick={() => setVolume(volume > 0 ? 0 : 1)} className="p-1.5" style={{ color: 'var(--toggle-off-knob)' }}>
                  {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
                <div className="w-28">
                  <SliderBar
                    value={volume}
                    max={1}
                    displayPercent={volume * 100}
                    onChange={(v) => setVolume(parseFloat(String(v)))}
                    onStart={handleVolumeStart}
                    onEnd={handleVolumeEnd}
                    height="h-1"
                    trackColor="var(--slider-track)"
                    fillColor="var(--slider-fill)"
                    thumbColor="var(--slider-fill-strong)"
                    step={0.01}
                    onWheel={(e) => { e.preventDefault(); setVolume(Math.max(0, Math.min(1, volume + (e.deltaY < 0 ? 0.05 : -0.05)))); }}
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-center">
                <AudioVisualizer analyser={analyser} isPlaying={isPlaying} barCount={40} barWidth={3} barGap={2} maxHeight={28} mirror opacity={0.5} />
              </div>
            </div>

            <div className="flex-1 lg:w-1/2 flex flex-col lg:pl-6 pt-2 lg:pt-0 min-h-0">
              <div className="flex items-center gap-1 mb-2 lg:mb-3">
                <button
                  onClick={() => setFullPlayerTab('queue')}
                  className="px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5"
                  style={{
                    backgroundColor: fullPlayerTab === 'queue' ? 'var(--tab-active)' : '',
                    color: fullPlayerTab === 'queue' ? 'hsl(var(--foreground))' : 'hsl(var(--foreground))',
                    opacity: fullPlayerTab === 'queue' ? 1 : 0.5,
                  }}
                  onMouseEnter={(e) => { if (fullPlayerTab !== 'queue') { e.currentTarget.style.opacity = '1'; e.currentTarget.style.backgroundColor = 'var(--hover-highlight)'; } }}
                  onMouseLeave={(e) => { if (fullPlayerTab !== 'queue') { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.backgroundColor = ''; } }}
                >
                  <List className="h-3.5 w-3.5" />Queue
                </button>
                <button
                  onClick={() => setFullPlayerTab('lyrics')}
                  className="px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5"
                  style={{
                    backgroundColor: fullPlayerTab === 'lyrics' ? 'var(--tab-active)' : '',
                    color: fullPlayerTab === 'lyrics' ? 'hsl(var(--foreground))' : 'hsl(var(--foreground))',
                    opacity: fullPlayerTab === 'lyrics' ? 1 : 0.5,
                  }}
                  onMouseEnter={(e) => { if (fullPlayerTab !== 'lyrics') { e.currentTarget.style.opacity = '1'; e.currentTarget.style.backgroundColor = 'var(--hover-highlight)'; } }}
                  onMouseLeave={(e) => { if (fullPlayerTab !== 'lyrics') { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.backgroundColor = ''; } }}
                >
                  <Mic2 className="h-3.5 w-3.5" />Lyrics
                </button>
              </div>

              <PlayerRightPanel
                fullPlayerTab={fullPlayerTab}
                queue={queue}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                upcomingQueue={upcomingQueue}
                clearQueue={clearQueue}
                handlePlayFromQueue={handlePlayFromQueue}
                getQueueContextItems={getQueueContextItems}
                lyrics={lyrics}
                lyricsLoading={lyricsLoading}
                activeLyricIndex={activeLyricIndex}
                lyricsRef={lyricsRef}
                variant="expanded"
                onPushQueue={() => {
                  const ids = queue.map(t => t.id);
                  apiClient.savePlayQueue(ids, currentTrack?.id, Math.floor(position * 1000)).catch(() => {});
                }}
                onGetQueue={() => loadQueueFromServer()}
                onRetryLyrics={() => { fetchingLyricsForId.current = null; setLyrics([]); setLyricsLoading(true); apiClient.getLyricsBySongId(currentTrack!.id).then((data) => { setLyrics(data); setLyricsLoading(false); }).catch(() => { setLyrics([]); setLyricsLoading(false); }); }}
                onQueueScrollRef={panelQueueScrollRef}
              />
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className={cn(
        'flex-1 overflow-y-auto',
        isPlayerOpen && 'hidden'
      )} style={isPlayerOpen ? {} : { height: 'calc(100vh - 80px)' }}>
        {children}
      </main>

      {/* MINI PLAYER */}
      {playerMode === 'mini' && (
        <div
          className="fixed bottom-0 right-0 left-0 z-20 border-t"
          style={{ backgroundColor: 'hsl(var(--card))' }}
        >
          <div className="flex items-center h-[72px]">
            {/* LEFT: cover + info stack + menu */}
            <div className="flex items-center gap-3 pl-3 w-[320px] flex-shrink-0">
              <div
                onClick={() => currentTrack && setPlayerMode('expanded')}
                className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer"
              >
                {currentTrack && miniCoverUrl ? (
                  <img src={miniCoverUrl} alt={currentTrack.title} className="w-full h-full object-cover" />
                ) : (
                  <Music className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 w-[220px]" onClick={() => currentTrack && setPlayerMode('expanded')} style={{ cursor: currentTrack ? 'pointer' : 'default' }}>
                <div className="flex items-center gap-1.5">
                  <MarqueeText className="text-sm font-semibold">{currentTrack?.title ?? 'No track playing'}</MarqueeText>
                  {currentTrack && <span onClick={(e) => { e.stopPropagation(); qualityBadge.toggleDetail(); }} className="px-1 py-0.5 rounded text-[8px] font-bold tracking-wide cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0" style={{ border: '1px solid hsl(var(--muted-foreground))', color: 'hsl(var(--muted-foreground))' }}>{qualityBadge.text}</span>}
                </div>
                <MarqueeText className="text-xs text-muted-foreground">{currentTrack ? getArtistDisplay(currentTrack).text : '—'}</MarqueeText>
                {currentTrack?.album && <MarqueeText className="text-[10px] text-muted-foreground/60">{currentTrack.album}</MarqueeText>}
              </div>
              {currentTrack && (
              <ContextMenu items={getCurrentTrackContextItems()} trigger="click">
                <button
                  className="p-1.5 rounded-full transition-colors text-muted-foreground hover:text-foreground hover:bg-accent flex-shrink-0"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </ContextMenu>
              )}
            </div>

            {/* CENTER: controls + progress */}
            <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleShuffle}
                  className="p-1 rounded-full transition-colors"
                  style={{ color: shuffle ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}
                >
                  <Shuffle className="h-3.5 w-3.5" />
                </button>
                <button onClick={previous} className="p-1 rounded-full transition-colors text-muted-foreground hover:text-foreground">
                  <SkipBack className="h-4 w-4" />
                </button>
                <button
                  onClick={() => isPlaying ? pause() : resume()}
                  className="h-8 w-8 rounded-full flex items-center justify-center transition-all active:scale-95"
                  style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                </button>
                <button onClick={next} className="p-1 rounded-full transition-colors text-muted-foreground hover:text-foreground">
                  <SkipForward className="h-4 w-4" />
                </button>
                <button
                  onClick={toggleRepeat}
                  className="p-1 rounded-full transition-colors relative"
                  style={{ color: repeat !== 'off' ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}
                >
                  <Repeat className="h-3.5 w-3.5" />
                  {repeat === 'one' && <span className="absolute -top-0.5 -right-0.5 text-[6px] font-black text-primary">1</span>}
                </button>
              </div>
              <div className="flex items-center gap-2 w-64">
                <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{formatTime(position)}</span>
                <div className="flex-1 cursor-pointer h-1 rounded-full relative">
                  <div className="absolute inset-0 rounded-full" style={{ backgroundColor: 'var(--slider-track)' }} />
                  <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${progress}%`, backgroundColor: 'var(--slider-fill)', transition: 'width 0.15s linear' }} />
                  <input
                    type="range"
                    min={0}
                    max={duration || 1}
                    step={0.1}
                    value={position}
                    onChange={(e) => seek(parseFloat(e.target.value))}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer"
                  />
                </div>
                <span className="text-[10px] text-muted-foreground tabular-nums w-8">{formatTime(duration)}</span>
              </div>
            </div>

            {/* RIGHT: volume + queue */}
            <div className="flex items-center gap-2 pr-3 w-[200px] flex-shrink-0">
              <button onClick={() => setVolume(volume > 0 ? 0 : 1)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <div className="w-24">
                <SliderBar
                  value={volume}
                  max={1}
                  displayPercent={volume * 100}
                  onChange={(v) => setVolume(parseFloat(String(v)))}
                  onStart={handleVolumeStart}
                  onEnd={handleVolumeEnd}
                  height="h-1"
                  trackColor="var(--slider-track)"
                  fillColor="var(--slider-fill)"
                  thumbColor="var(--slider-fill-strong)"
                  step={0.01}
                  onWheel={(e) => { e.preventDefault(); setVolume(Math.max(0, Math.min(1, volume + (e.deltaY < 0 ? 0.05 : -0.05)))); }}
                />
              </div>
              <button onClick={() => setShowQueue(!showQueue)} className="p-1.5 rounded-full transition-colors" style={{ color: showQueue ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}>
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DROPDOWN QUEUE */}
      {showQueue && playerMode === 'mini' && (
        <div className="fixed right-0 bottom-20 left-0 z-30 border-t max-h-80 overflow-hidden shadow-2xl animate-slide-up transition-all duration-300" style={{ backgroundColor: 'hsl(var(--card))' }}>
          <div className="flex items-center justify-between p-3 border-b">
            <div>
              <h3 className="text-sm font-semibold">Queue</h3>
              <p className="text-xs text-muted-foreground">{queue.length} songs &middot; {upcomingQueue.length} up next</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const ids = queue.map(t => t.id);
                  apiClient.savePlayQueue(ids, currentTrack?.id, Math.floor(position * 1000)).catch(() => {});
                }}
                className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                title="Push queue to server"
              >
                <Upload className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => loadQueueFromServer()}
                className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                title="Get queue from server"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              {upcomingQueue.length > 0 && (
                <button onClick={clearQueue} className="px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-md transition-colors flex items-center gap-1">
                  <Trash2 className="h-3 w-3" />Clear
                </button>
              )}
              <button onClick={() => setShowQueue(false)} className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors">
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </div>
          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <ListMusic className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-xs mb-3">Queue is empty</p>
              <button
                onClick={() => loadQueueFromServer()}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-accent hover:bg-accent/80 transition-colors flex items-center gap-1.5"
              >
                <Download className="h-3 w-3" />Get queue from server
              </button>
            </div>
          ) : (
            <div ref={dropdownQueueRef} className="overflow-y-auto max-h-64 scrollbar-none">
              <div className="p-1.5">
                {queue.map((track, idx) => {
                  const isCurrent = currentTrack?.id === track.id;
                  return (
                <ContextMenu key={`${track.id}-${idx}`} items={getQueueContextItems(track, idx)}>
                    <div
                      data-queue-id={track.id}
                      onClick={() => handlePlayFromQueue(idx)}
                      draggable
                      onDragStart={(e) => { setDropdownDragIdx(idx); e.dataTransfer.effectAllowed = 'move'; }}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropdownDragOverIdx(idx); }}
                      onDragLeave={() => setDropdownDragOverIdx(null)}
                      onDrop={() => {
                        if (dropdownDragIdx !== null && dropdownDragIdx !== idx) {
                          usePlayerStore.getState().moveInQueue(dropdownDragIdx, idx);
                        }
                        setDropdownDragIdx(null);
                        setDropdownDragOverIdx(null);
                      }}
                      onDragEnd={() => { setDropdownDragIdx(null); setDropdownDragOverIdx(null); }}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm cursor-pointer transition-all duration-150',
                        isCurrent ? 'bg-primary/15 border border-primary/20' : 'hover:bg-accent',
                        dropdownDragIdx === idx && 'opacity-40',
                        dropdownDragOverIdx === idx && dropdownDragIdx !== idx && 'border-t-2 border-primary',
                      )}
                    >
                      <span className="cursor-grab text-muted-foreground hover:text-foreground flex-shrink-0" onClick={(e) => e.stopPropagation()}><GripVertical className="h-3.5 w-3.5" /></span>
                      <span className={cn('w-5 text-center text-xs font-medium', isCurrent ? 'text-primary' : 'text-muted-foreground')}>{idx + 1}</span>
                      <div className="h-9 w-9 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                        {track.coverArt ? <img src={apiClient.buildCoverArtUrl(track.coverArt, 60)} alt={track.title} className="w-full h-full object-cover" /> : <Music className="h-3.5 w-3.5 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn('truncate font-medium text-xs', isCurrent && 'text-primary')}>{track.title}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{getArtistDisplay(track).text}</p>
                      </div>
                      {isCurrent && (
                        <div className="flex items-end gap-0.5 h-3 mr-1">
                          {isPlaying ? (
                            <>
                              <span className="w-0.5 bg-primary rounded-full animate-eq-1" style={{ height: '3px' }} />
                              <span className="w-0.5 bg-primary rounded-full animate-eq-2" style={{ height: '5px' }} />
                              <span className="w-0.5 bg-primary rounded-full animate-eq-3" style={{ height: '4px' }} />
                            </>
                          ) : (
                            <Play className="h-3 w-3 text-primary" />
                          )}
                        </div>
                      )}
                      <span className="text-[10px] text-muted-foreground tabular-nums">{formatTime(track.duration || 0)}</span>
                    </div>
                  </ContextMenu>
                  );
                })}
              </div>
            </div>
          )}
        </div>
       )}
 
       {/* FULLSCREEN PLAYER */}
      {playerMode === 'fullscreen' && currentTrack && (
        <div ref={fullPlayerRef} className="fixed inset-0 z-50 flex flex-col animate-fade-in" style={{ cursor: controlsVisible ? 'default' : 'none' }}>
          {displayedBgCoverUrl ? (
            <>
              <div className="absolute inset-0 bg-cover bg-center scale-125" style={{ backgroundImage: `url(${displayedBgCoverUrl})`, filter: 'blur(20px)' }} />
              <div className="absolute inset-0" style={{ backgroundColor: 'var(--player-overlay-strong)' }} />
            </>
          ) : (
            <div className="absolute inset-0 bg-background" />
          )}

          <div className={cn(
            'relative z-10 flex items-center justify-between p-4 transition-opacity duration-700',
            controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}>
            <button
              onClick={() => setPlayerMode('expanded')}
              className="flex items-center gap-2 transition-colors px-2 py-1.5 rounded-md text-sm"
              style={{ color: 'hsl(var(--foreground))', opacity: 0.7 }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.backgroundColor = 'var(--hover-highlight)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.backgroundColor = ''; }}
            >
              <ChevronDown className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-1">
              <ContextMenu items={getCurrentTrackContextItems()} trigger="click" portalTarget={fullPlayerRef.current}>
                <button
                  className="p-1.5 transition-colors rounded-md"
                  style={{ color: 'hsl(var(--foreground))', opacity: 0.7 }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.backgroundColor = 'var(--hover-highlight)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.backgroundColor = ''; }}
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </ContextMenu>
              <button
                onClick={() => setPlayerMode('expanded')}
                className="p-1.5 transition-colors rounded-md"
                style={{ color: 'hsl(var(--foreground))', opacity: 0.7 }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.backgroundColor = 'var(--hover-highlight)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.backgroundColor = ''; }}
                title="Exit fullscreen"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="relative z-10 flex-1 flex min-h-0 px-4 sm:px-6 pb-4 sm:pb-6 flex-col lg:flex-row">
            <div className="flex-1 lg:w-1/2 flex flex-col items-center justify-center lg:py-0">
                <div className="w-40 h-40 sm:w-56 sm:h-56 md:w-64 md:h-64 lg:w-72 lg:h-72 xl:w-80 xl:h-80 2xl:w-96 2xl:h-96 rounded-2xl shadow-2xl overflow-hidden mb-4 lg:mb-6 flex-shrink-0" style={{ backgroundColor: 'var(--cover-container-bg)' }}>
                  {fullPlayerCoverUrl ? (
                  <img src={fullPlayerCoverUrl} alt={currentTrack.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ color: 'hsl(var(--foreground))', opacity: 0.2 }}>
                    <Music className="h-20 w-20" />
                  </div>
                )}
              </div>

                <div className="text-center mb-4 lg:mb-6 w-full max-w-xs xl:max-w-sm 2xl:max-w-md mx-auto">
                  <MarqueeText className="text-lg sm:text-xl xl:text-2xl font-bold mb-1">{currentTrack.title}</MarqueeText>
                  <ArtistLink track={currentTrack} onNavigate={() => setPlayerMode('mini')} fs />
                  {currentTrack.album && (
                    <MarqueeText className="text-xs sm:text-sm mt-0.5">
                      <span
                        onClick={(e) => { e.stopPropagation(); if (currentTrack.albumId) { navigate(`/album/${currentTrack.albumId}`); setPlayerMode('mini'); } }}
                        className="cursor-pointer transition-all duration-150"
                        style={{ color: 'hsl(var(--foreground))', opacity: 0.5 }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.5'; (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
                      >{currentTrack.album}</span>
                    </MarqueeText>
                  )}
                </div>

                  <div className="w-full max-w-xs xl:max-w-sm 2xl:max-w-md mx-auto mb-4 lg:mb-6">
                    <SliderBar
                      value={isSeeking ? seekValue : position}
                      max={duration || 1}
                      displayPercent={displayProgress}
                      onChange={handleSeekChange}
                      onStart={handleSeekStart}
                      onEnd={handleSeekEnd}
                      height="h-1.5"
                      trackColor="var(--slider-track)"
                      fillColor="var(--slider-fill)"
                      thumbColor="var(--slider-fill-strong)"
                      bufferPercent={bufferedPercent}
                    />
                  <div className="flex justify-between items-center text-[11px] mt-2" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)', color: 'var(--toggle-off-knob)' }}>
                    <span className="tabular-nums">{formatTime(isSeeking ? seekValue : position)}</span>
                     <span onClick={(e) => { e.stopPropagation(); qualityBadge.toggleDetail(); }} className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide cursor-pointer hover:opacity-80 transition-opacity" style={{ border: '1px solid currentColor', textShadow: 'none' }}>{qualityBadge.text}</span>
                    <span className="tabular-nums">{formatTime(duration)}</span>
                  </div>
                </div>

              <div className={cn('flex flex-col items-center transition-opacity duration-700', controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none')}>
                <div className="flex items-center gap-3 sm:gap-4 xl:gap-5 mb-3">
                  <ControlButton onClick={toggleShuffle} active={shuffle} icon={<Shuffle className="h-5 w-5" />} size="lg" />
                  <ControlButton onClick={previous} icon={<SkipBack className="h-5 w-5 sm:h-6 sm:w-6" />} size="lg" />
                  <button
                    onClick={() => isPlaying ? pause() : resume()}
                    className="h-12 w-12 sm:h-14 sm:w-14 xl:h-16 xl:w-16 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95"
                    style={{ backgroundColor: 'var(--toggle-on)', color: 'var(--toggle-on-knob)', boxShadow: '0 4px 14px rgba(0,0,0,0.3)' }}
                  >
                    {isPlaying ? <Pause className="h-5 w-5 sm:h-6 sm:w-6" /> : <Play className="h-5 w-5 sm:h-6 sm:w-6 ml-0.5" />}
                  </button>
                  <ControlButton onClick={next} icon={<SkipForward className="h-5 w-5 sm:h-6 sm:w-6" />} size="lg" />
                  <ControlButton
                    onClick={toggleRepeat}
                    active={repeat !== 'off'}
                    icon={
                      <span className="relative">
                        <Repeat className="h-5 w-5" />
                        {repeat === 'one' && <span className="absolute -top-1 -right-1 text-[8px] font-black" style={{ color: 'var(--toggle-on-knob)' }}>1</span>}
                      </span>
                    }
                    size="lg"
                  />
                </div>

                <div className="flex items-center justify-center gap-2.5">
                  <button onClick={() => setVolume(volume > 0 ? 0 : 1)} className="p-1.5 transition-colors" style={{ color: 'hsl(var(--foreground))', opacity: 0.5 }} onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; }}>
                    {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </button>
                  <div className="w-28">
                    <SliderBar
                      value={volume}
                      max={1}
                      displayPercent={volume * 100}
                      onChange={(v) => setVolume(parseFloat(String(v)))}
                      onStart={handleVolumeStart}
                      onEnd={handleVolumeEnd}
                      height="h-1"
                      trackColor="var(--slider-track)"
                      fillColor="var(--slider-fill)"
                      thumbColor="var(--slider-fill-strong)"
                      step={0.01}
                      onWheel={(e) => { e.preventDefault(); setVolume(Math.max(0, Math.min(1, volume + (e.deltaY < 0 ? 0.05 : -0.05)))); }}
                    />
                  </div>
                </div>
               </div>

                <div className="mt-4 flex justify-center">
                  <AudioVisualizer analyser={analyser} isPlaying={isPlaying} barCount={48} barWidth={3} barGap={2} maxHeight={32} mirror opacity={0.45} />
               </div>
             </div>

             <div className="flex-1 lg:w-1/2 flex flex-col lg:pl-6 pt-2 lg:pt-0 min-h-0">
               <div className={cn('flex items-center gap-1 mb-2 lg:mb-3 transition-opacity duration-700', controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none')}>
                <button
                  onClick={() => setFullPlayerTab('queue')}
                  className="px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5"
                  style={{
                    backgroundColor: fullPlayerTab === 'queue' ? 'var(--tab-active)' : '',
                    color: 'hsl(var(--foreground))',
                    opacity: fullPlayerTab === 'queue' ? 1 : 0.5,
                  }}
                  onMouseEnter={(e) => { if (fullPlayerTab !== 'queue') { e.currentTarget.style.opacity = '1'; e.currentTarget.style.backgroundColor = 'var(--hover-highlight)'; } }}
                  onMouseLeave={(e) => { if (fullPlayerTab !== 'queue') { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.backgroundColor = ''; } }}
                >
                  <List className="h-3.5 w-3.5" />Queue
                </button>
                <button
                  onClick={() => setFullPlayerTab('lyrics')}
                  className="px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5"
                  style={{
                    backgroundColor: fullPlayerTab === 'lyrics' ? 'var(--tab-active)' : '',
                    color: 'hsl(var(--foreground))',
                    opacity: fullPlayerTab === 'lyrics' ? 1 : 0.5,
                  }}
                  onMouseEnter={(e) => { if (fullPlayerTab !== 'lyrics') { e.currentTarget.style.opacity = '1'; e.currentTarget.style.backgroundColor = 'var(--hover-highlight)'; } }}
                  onMouseLeave={(e) => { if (fullPlayerTab !== 'lyrics') { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.backgroundColor = ''; } }}
                >
                  <Mic2 className="h-3.5 w-3.5" />Lyrics
                </button>
              </div>

              <PlayerRightPanel
                fullPlayerTab={fullPlayerTab}
                queue={queue}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                upcomingQueue={upcomingQueue}
                clearQueue={clearQueue}
                handlePlayFromQueue={handlePlayFromQueue}
                getQueueContextItems={getQueueContextItems}
                lyrics={lyrics}
                lyricsLoading={lyricsLoading}
                activeLyricIndex={activeLyricIndex}
                lyricsRef={lyricsRef}
                variant="fullscreen"
                onPushQueue={() => {
                  const ids = queue.map(t => t.id);
                  apiClient.savePlayQueue(ids, currentTrack?.id, Math.floor(position * 1000)).catch(() => {});
                }}
                onGetQueue={() => loadQueueFromServer()}
                onRetryLyrics={() => { fetchingLyricsForId.current = null; setLyrics([]); setLyricsLoading(true); apiClient.getLyricsBySongId(currentTrack!.id).then((data) => { setLyrics(data); setLyricsLoading(false); }).catch(() => { setLyrics([]); setLyricsLoading(false); }); }}
                onQueueScrollRef={panelQueueScrollRef}
                portalTarget={fullPlayerRef.current}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SliderBar({
  value,
  max,
  displayPercent,
  onChange,
  onStart,
  onEnd,
  height = 'h-2',
  trackColor = 'var(--slider-track)',
  fillColor = 'var(--slider-fill)',
  thumbColor = 'var(--slider-fill-strong)',
  step,
  onWheel,
  bufferPercent,
}: {
  value: number;
  max: number;
  displayPercent: number;
  onChange: (v: number) => void;
  onStart: () => void;
  onEnd: (v: number) => void;
  height?: string;
  trackColor?: string;
  fillColor?: string;
  thumbColor?: string;
  step?: number | string;
  onWheel?: (e: React.WheelEvent) => void;
  bufferPercent?: number;
}) {
  return (
    <div
      className={cn('relative cursor-pointer rounded-full group/seek', height)}
      onWheel={onWheel}
    >
      <div className="absolute inset-0 rounded-full" style={{ backgroundColor: trackColor }} />
      {bufferPercent !== undefined && bufferPercent > 0 && (
        <div
          className="absolute inset-y-0 left-0 rounded-full opacity-30"
          style={{ width: `${bufferPercent}%`, backgroundColor: fillColor }}
        />
      )}
      <div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${displayPercent}%`, transition: 'width 0.15s linear', backgroundColor: fillColor }}
      />
      <div
        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full shadow-sm opacity-0 group-hover/seek:opacity-100 transition-opacity"
        style={{ left: `${displayPercent}%`, marginLeft: '-6px', backgroundColor: thumbColor }}
      />
      <input
        type="range"
        min={0}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onMouseDown={onStart}
        onMouseUp={(e) => onEnd(parseFloat(e.currentTarget.value))}
        onTouchStart={onStart}
        onTouchEnd={(e) => onEnd(parseFloat(e.currentTarget.value))}
        className="absolute inset-0 w-full opacity-0 cursor-pointer"
      />
    </div>
  );
}

interface PlayerRightPanelProps {
  fullPlayerTab: FullPlayerTab;
  queue: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  upcomingQueue: Track[];
  clearQueue: () => void;
  handlePlayFromQueue: (idx: number) => void;
  getQueueContextItems: (track: Track, idx: number) => ContextMenuItem[];
  lyrics: StructuredLyrics[];
  lyricsLoading: boolean;
  activeLyricIndex: number;
  lyricsRef: React.RefObject<HTMLDivElement | null>;
  variant: 'expanded' | 'fullscreen';
  onPushQueue?: () => void;
  onGetQueue?: () => void;
  onRetryLyrics?: () => void;
  onQueueScrollRef?: (el: HTMLDivElement | null) => void;
  portalTarget?: HTMLElement | null;
}

function PlayerRightPanel({
  fullPlayerTab,
  queue,
  currentTrack,
  isPlaying,
  upcomingQueue,
  clearQueue,
  handlePlayFromQueue,
  getQueueContextItems,
  lyrics,
  lyricsLoading,
  activeLyricIndex,
  lyricsRef,
  variant,
  onPushQueue,
  onGetQueue,
  onRetryLyrics,
  onQueueScrollRef,
  portalTarget,
}: PlayerRightPanelProps) {
  const fs = variant === 'fullscreen';
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const panelBg = 'border-foreground/10';
  const panelBgStyle = fs || variant === 'expanded'
    ? { backgroundColor: isDark ? 'rgba(10, 10, 15, 0.75)' : 'rgba(255, 255, 255, 0.75)' }
    : {};
  const borderClr = 'border-foreground/10';
  const [panelDragIdx, setPanelDragIdx] = useState<number | null>(null);
  const [panelDragOverIdx, setPanelDragOverIdx] = useState<number | null>(null);

  return (
    <div className={cn('flex-1 rounded-xl overflow-hidden flex flex-col border', panelBg)} style={panelBgStyle}>
      {fullPlayerTab === 'queue' && (
        <>
          <div className={cn('flex items-center justify-between p-3 border-b', borderClr)}>
            <div>
              <h3 className="text-sm font-semibold">Queue</h3>
              <p className={cn('text-xs', fs ? 'text-foreground/40' : 'text-muted-foreground')}>{upcomingQueue.length} up next</p>
            </div>
            <div className="flex items-center gap-1.5">
              {onPushQueue && (
                <button onClick={onPushQueue} className={cn('p-1 rounded transition-colors', fs ? 'text-foreground/50 hover:text-foreground hover:bg-foreground/10' : 'text-muted-foreground hover:text-foreground hover:bg-accent')} title="Push queue to server">
                  <Upload className="h-3.5 w-3.5" />
                </button>
              )}
              {onGetQueue && (
                <button onClick={onGetQueue} className={cn('p-1 rounded transition-colors', fs ? 'text-foreground/50 hover:text-foreground hover:bg-foreground/10' : 'text-muted-foreground hover:text-foreground hover:bg-accent')} title="Get queue from server">
                  <Download className="h-3.5 w-3.5" />
                </button>
              )}
              {upcomingQueue.length > 0 && (
                <button onClick={clearQueue} className={cn('px-2 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1', fs ? 'text-red-400 hover:bg-red-500/10' : 'text-destructive hover:bg-destructive/10')}>
                  <Trash2 className="h-3 w-3" />Clear
                </button>
              )}
            </div>
          </div>
          <div ref={onQueueScrollRef} className="flex-1 overflow-y-auto p-1.5 scrollbar-none">
            {queue.length === 0 ? (
              <div className={cn('flex flex-col items-center justify-center h-full py-8', fs ? 'text-foreground/30' : 'text-muted-foreground')}>
                <ListMusic className="h-10 w-10 mb-2 opacity-40" />
                <p className="text-xs">Queue is empty</p>
              </div>
            ) : (
              queue.map((track, idx) => {
                const isCurrent = currentTrack?.id === track.id;
                return (
                <ContextMenu key={`${track.id}-${idx}`} items={getQueueContextItems(track, idx)} portalTarget={portalTarget}>
                  <div
                    data-queue-id={track.id}
                    onClick={() => handlePlayFromQueue(idx)}
                    draggable
                    onDragStart={(e) => { setPanelDragIdx(idx); e.dataTransfer.effectAllowed = 'move'; }}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setPanelDragOverIdx(idx); }}
                    onDragLeave={() => setPanelDragOverIdx(null)}
                    onDrop={() => {
                      if (panelDragIdx !== null && panelDragIdx !== idx) {
                        usePlayerStore.getState().moveInQueue(panelDragIdx, idx);
                      }
                      setPanelDragIdx(null);
                      setPanelDragOverIdx(null);
                    }}
                    onDragEnd={() => { setPanelDragIdx(null); setPanelDragOverIdx(null); }}
                    className={cn(
                      'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm cursor-pointer transition-all duration-150',
                      isCurrent
                        ? fs ? 'bg-foreground/15 border border-foreground/20' : 'bg-primary/15 border border-primary/20'
                        : fs ? 'hover:bg-foreground/10' : 'hover:bg-accent',
                      panelDragIdx === idx && 'opacity-40',
                      panelDragOverIdx === idx && panelDragIdx !== idx && 'border-t-2 border-primary',
                    )}
                  >
                    <span className={cn('cursor-grab flex-shrink-0', fs ? 'text-foreground/30 hover:text-foreground/60' : 'text-muted-foreground hover:text-foreground')} onClick={(e) => e.stopPropagation()}><GripVertical className="h-3.5 w-3.5" /></span>
                    <span className={cn('w-4 text-center text-[10px] tabular-nums', isCurrent ? (fs ? 'text-foreground' : 'text-primary') : (fs ? 'text-foreground/40' : 'text-muted-foreground'))}>{idx + 1}</span>
                    <div className={cn('h-8 w-8 rounded flex items-center justify-center overflow-hidden flex-shrink-0', fs ? 'bg-foreground/10' : 'bg-muted/50')}>
                      {track.coverArt ? <img src={apiClient.buildCoverArtUrl(track.coverArt, 60)} alt={track.title} className="w-full h-full object-cover" /> : <Music className={cn('h-3 w-3', fs ? 'text-foreground/30' : 'text-muted-foreground')} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn('truncate font-medium text-xs', isCurrent && (fs ? 'text-foreground' : 'text-primary'))}>{track.title}</p>
                      <p className={cn('text-[10px] truncate', fs ? 'text-foreground/40' : 'text-muted-foreground')}>{getArtistDisplay(track).text}</p>
                    </div>
                    {isCurrent && (
                      <div className="flex items-end gap-0.5 h-3 mr-1">
                        {isPlaying ? (
                          <>
                            <span className="w-0.5 bg-primary rounded-full animate-eq-1" style={{ height: '3px' }} />
                            <span className="w-0.5 bg-primary rounded-full animate-eq-2" style={{ height: '5px' }} />
                            <span className="w-0.5 bg-primary rounded-full animate-eq-3" style={{ height: '4px' }} />
                          </>
                        ) : (
                          <Play className={cn('h-3 w-3', fs ? 'text-foreground' : 'text-primary')} />
                        )}
                      </div>
                    )}
                    <span className={cn('text-[10px] tabular-nums', fs ? 'text-foreground/40' : 'text-muted-foreground')}>{formatTime(track.duration || 0)}</span>
                  </div>
                </ContextMenu>
                );
              })
            )}
          </div>
        </>
      )}

      {fullPlayerTab === 'lyrics' && (
        <>
          <div className={cn('p-3 border-b', borderClr)}>
            <h3 className="text-sm font-semibold">Lyrics</h3>
            {currentTrack && <p className={cn('text-xs', fs ? 'text-foreground/40' : 'text-muted-foreground')}>{currentTrack.title}</p>}
          </div>
          <div ref={lyricsRef} className="flex-1 overflow-y-auto px-4 py-6 scrollbar-none">
            {lyricsLoading ? (
              <div className={cn('flex flex-col items-center justify-center h-full gap-3', fs ? 'text-foreground/30' : 'text-muted-foreground')}>
                <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin opacity-50" />
                <p className="text-xs">Loading lyrics...</p>
              </div>
            ) : lyrics.length > 0 && lyrics[0]?.line && lyrics[0].line.length > 0 ? (
              <div className="space-y-1">
                {lyrics[0].line.map((line, idx) => {
                  const isActive = idx === activeLyricIndex;
                  const isPast = activeLyricIndex >= 0 && idx < activeLyricIndex;
                  return (
                    <p
                      key={idx}
                      data-lyric-idx={idx}
                      onClick={lyrics[0].synced && line.start !== undefined ? () => {
                        const store = usePlayerStore.getState();
                        if (store.seek) store.seek(line.start! / 1000);
                      } : undefined}
                      className="text-[clamp(16px,3vw,26px)] leading-relaxed font-semibold transition-colors duration-500 cursor-pointer"
                      style={{
                        color: isActive
                          ? (isDark ? '#ffffff' : '#000000')
                          : isPast
                            ? (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)')
                            : (isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)')
                      }}
                    >
                      {line.value || '\u00A0'}
                    </p>
                  );
                })}
              </div>
            ) : (
              <div className={cn('flex flex-col items-center justify-center h-full gap-3', fs ? 'text-foreground/30' : 'text-muted-foreground')}>
                <Mic2 className="h-12 w-12 opacity-30" />
                <div className="text-center">
                  <p className="text-sm font-medium mb-1">No lyrics available</p>
                  <p className="text-xs opacity-60">Lyrics will appear here when available</p>
                  {onRetryLyrics && (
                    <button
                      onClick={onRetryLyrics}
                      className={cn('mt-3 px-3 py-1.5 text-xs font-medium rounded-md transition-colors', fs ? 'bg-foreground/10 hover:bg-foreground/20 text-foreground/60' : 'bg-accent hover:bg-accent/80')}
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

 function ControlButton({
  onClick,
  active,
  icon,
  size = 'md',
}: {
  onClick: () => void;
  active?: boolean;
  icon: React.ReactNode;
  size?: 'md' | 'lg';
}) {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const activeBg = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';
  const activeColor = isDark ? '#ffffff' : '#000000';
  const inactiveColor = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
  const hoverBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full transition-all duration-200 active:scale-90 flex items-center justify-center',
        size === 'lg' ? 'p-2.5' : 'p-1.5'
      )}
      style={{
        backgroundColor: active ? activeBg : 'transparent',
        color: active ? activeColor : inactiveColor,
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = hoverBg; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
    >
      {icon}
    </button>
  );
}
