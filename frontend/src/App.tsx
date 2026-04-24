import { useEffect, useState } from 'react';
import { Disc3 } from 'lucide-react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { PlatformProvider, usePlatform } from '@/platform';
import { useAuthStore, usePlayerStore, useUpdateStore, initializeAuthStore, initializePlayerStore, connectDiscordRPC, refreshDiscordPresence, clearDiscordRPC } from '@/stores';
import { useTheme } from '@/hooks';
import { AppLayout } from '@/components';
import { LoginScreen, HomeScreen, LibraryScreen, SearchScreen, PlaylistsScreen, FavoritesScreen, SettingsScreen, AlbumScreen, ArtistScreen } from '@/screens';

function AppContent() {
  const platform = usePlatform();
  const { isAuthenticated, loadServers } = useAuthStore();
  const { setPosition, setDuration, setIsPlaying, next, previous, handleTrackError, volume, loadQueueFromServer, setBuffered, setBuffering } = usePlayerStore();
  const { setUpdateStatus, setUpdateInfo, setProgress, setError, setCanAutoUpdate } = useUpdateStore();
  const [initialized, setInitialized] = useState(false);
  
  useTheme();

  useEffect(() => {
    initializeAuthStore(platform);
    initializePlayerStore(platform);
    connectDiscordRPC().then(() => refreshDiscordPresence());
    const mpvReady = (async () => {
      if (platform.isDesktop && platform.enableMpv) {
        const mpvSetting = localStorage.getItem('dino_mpv');
        if (mpvSetting && JSON.parse(mpvSetting)) {
          const available = await platform.detectMpv?.();
          if (available) await platform.enableMpv?.();
        }
      }
    })();
    const serversReady = loadServers();
    Promise.all([mpvReady, serversReady]).then(() => {
      setInitialized(true);
      loadQueueFromServer();
    }).catch(() => setInitialized(true));
  }, []);

  useEffect(() => {
    const unsubPosition = platform.onPositionChange(setPosition);
    const unsubDuration = platform.onDurationChange(setDuration);
    const unsubBuffer = platform.onBufferChange(setBuffered);
    const unsubBuffering = platform.onBufferingChange?.(setBuffering) ?? (() => {});
    const unsubEnd = platform.onTrackEnd(next);
    const unsubError = platform.onTrackError(handleTrackError);
    const unsubPlayState = platform.onPlayStateChange(setIsPlaying);
    const unsubNext = platform.onNext(next);
    const unsubPrev = platform.onPrevious(previous);
    return () => {
      unsubPosition();
      unsubDuration();
      unsubBuffer();
      unsubBuffering();
      unsubEnd();
      unsubError();
      unsubPlayState();
      unsubNext();
      unsubPrev();
    };
  }, [platform, setPosition, setDuration, setIsPlaying, setBuffered, next, previous, handleTrackError]);

  useEffect(() => {
    platform.setVolume(volume);
  }, [platform, volume]);

  useEffect(() => {
    const cleanup = () => { clearDiscordRPC(); };
    window.addEventListener('beforeunload', cleanup);
    return () => window.removeEventListener('beforeunload', cleanup);
  }, []);

  useEffect(() => {
    if (!platform.isDesktop || !platform.checkForUpdate) return;

    if (platform.canAutoUpdate) platform.canAutoUpdate().then(setCanAutoUpdate);

    const unsubProgress = platform.onUpdateDownloadProgress?.((p) => setProgress(p));
    const unsubDownloaded = platform.onUpdateDownloaded?.(() => setUpdateStatus('downloaded'));
    const unsubError = platform.onUpdateError?.((msg) => {
      setError(msg);
      setUpdateStatus('error');
    });

    setUpdateStatus('checking');
    platform.checkForUpdate().then((result) => {
      if (result.available && result.info) {
        setUpdateInfo(result.info);
        setUpdateStatus('available');
      } else {
        setUpdateStatus('idle');
      }
    }).catch(() => setUpdateStatus('idle'));

    return () => {
      unsubProgress?.();
      unsubDownloaded?.();
      unsubError?.();
    };
  }, [platform]);

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Disc3 className="h-8 w-8 text-primary animate-spin" style={{ animationDuration: '2s' }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/library" element={<LibraryScreen />} />
        <Route path="/search" element={<SearchScreen />} />
        <Route path="/playlists" element={<PlaylistsScreen />} />
        <Route path="/favorites" element={<FavoritesScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/album/:id" element={<AlbumScreen />} />
        <Route path="/artist/:id" element={<ArtistScreen />} />
      </Routes>
    </AppLayout>
  );
}

function App() {
  return (
    <HashRouter>
      <PlatformProvider>
        <AppContent />
      </PlatformProvider>
    </HashRouter>
  );
}

export default App;
