import { useEffect, useState } from 'react';
import { apiClient } from '@/api/client';
import { usePlayerStore } from '@/stores';
import type { Playlist, GetPlaylistsResponse, GetPlaylistResponse, Track } from '@/api/types';
import { Music, Play, ListMusic, ArrowLeft, Plus, Shuffle, Trash2, Pencil, Check, X } from 'lucide-react';
import { LoadingScreen } from '@/components/ui';
import { TrackRow } from '@/components';
import { formatTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

export function PlaylistsScreen() {
  const { playQueue } = usePlayerStore();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const [renameValue, setRenameValue] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);

  useEffect(() => {
    loadPlaylists();
  }, []);

  const loadPlaylists = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.request<GetPlaylistsResponse>('getPlaylists');
      setPlaylists(data.playlists?.playlist || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load playlists');
    } finally {
      setLoading(false);
    }
  };

  const loadPlaylistTracks = async (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setLoading(true);
    try {
      const data = await apiClient.request<GetPlaylistResponse>('getPlaylist', { id: playlist.id });
      setTracks(data.playlist?.entry || []);
    } catch {
      // handled by empty tracks
    } finally {
      setLoading(false);
    }
  };

  const handlePlayAll = (shuffleMode = false) => {
    if (tracks.length === 0) return;
    playQueue(tracks, shuffleMode ? Math.floor(Math.random() * tracks.length) : 0);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const id = await apiClient.createPlaylist(newName.trim());
    setCreating(false);
    if (id) {
      setNewName('');
      setShowCreate(false);
      await loadPlaylists();
    }
  };

  const handleDelete = async (playlistId: string) => {
    await apiClient.deletePlaylist(playlistId);
    if (selectedPlaylist?.id === playlistId) {
      setSelectedPlaylist(null);
      setTracks([]);
    }
    await loadPlaylists();
  };

  const handleRename = async () => {
    if (!renamingId || !renameValue.trim()) return;
    await apiClient.updatePlaylist({
      playlistId: renamingId,
      name: renameValue.trim(),
    });
    setRenamingId(null);
    setRenameValue('');
    await loadPlaylists();
    if (selectedPlaylist?.id === renamingId) {
      setSelectedPlaylist({ ...selectedPlaylist, name: renameValue.trim() });
    }
  };

  const handleRemoveTrack = async (index: number) => {
    if (!selectedPlaylist) return;
    await apiClient.updatePlaylist({
      playlistId: selectedPlaylist.id,
      songIndexesToRemove: [index],
    });
    const newTracks = [...tracks];
    newTracks.splice(index, 1);
    setTracks(newTracks);
    await loadPlaylists();
  };

  if (loading && playlists.length === 0 && !selectedPlaylist) return <LoadingScreen />;

  if (error && playlists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 animate-fade-in">
        <Music className="h-16 w-16 text-muted-foreground/30" />
        <p className="text-destructive text-sm">{error}</p>
        <button onClick={loadPlaylists} className="text-sm text-primary hover:underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Playlists</h1>
        {selectedPlaylist && (
          <button
            onClick={() => { setSelectedPlaylist(null); setTracks([]); }}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        )}
      </div>

      {!selectedPlaylist ? (
        <div className="space-y-3 animate-fade-in">
          {showCreate ? (
            <div className="flex items-center gap-2 p-3 rounded-xl border bg-card">
              <input
                placeholder="Playlist name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm border-none outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {creating ? '...' : <Check className="h-4 w-4" />}
              </button>
              <button
                onClick={() => { setShowCreate(false); setNewName(''); }}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-3 border rounded-xl hover:bg-accent transition-colors text-sm text-muted-foreground hover:text-foreground w-full"
            >
              <Plus className="h-4 w-4" /> Create Playlist
            </button>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {playlists.map((playlist) => {
              const coverUrl = playlist.coverArt ? apiClient.buildCoverArtUrl(playlist.coverArt, 120) : null;
              const isRenaming = renamingId === playlist.id;
              return (
                <div
                  key={playlist.id}
                  className="group cursor-pointer p-4 rounded-xl border bg-card hover:bg-accent/50 active:scale-[0.98] transition-all duration-200"
                >
                  {isRenaming ? (
                    <div className="flex items-center gap-2 mb-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                        className="flex-1 bg-muted rounded-md px-2 py-1 text-sm border-none outline-none focus:ring-1 focus:ring-primary"
                        autoFocus
                      />
                      <button onClick={handleRename} className="p-1 text-green-500 hover:bg-green-500/10 rounded"><Check className="h-3.5 w-3.5" /></button>
                      <button onClick={() => { setRenamingId(null); }} className="p-1 text-muted-foreground hover:bg-accent rounded"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ) : null}
                  <div className="flex items-center gap-4" onClick={() => !isRenaming && loadPlaylistTracks(playlist)}>
                    <div className="h-14 w-14 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-md overflow-hidden flex-shrink-0">
                      {coverUrl ? (
                        <img src={coverUrl} alt={playlist.name} className="w-full h-full object-cover" />
                      ) : (
                        <ListMusic className="h-6 w-6 text-primary/60" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate text-sm">{playlist.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {playlist.songCount || 0} songs
                        {playlist.duration > 0 && <span className="text-muted-foreground/50"> &middot; {formatTime(playlist.duration)}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => { setRenamingId(playlist.id); setRenameValue(playlist.name); }}
                      className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(playlist.id)}
                      className="p-1.5 text-muted-foreground hover:text-destructive rounded-md hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">{selectedPlaylist.name}</h2>
              <p className="text-sm text-muted-foreground">
                {tracks.length} songs
                {tracks.length > 0 && <span className="text-muted-foreground/50"> &middot; {formatTime(tracks.reduce((a, t) => a + (t.duration || 0), 0))}</span>}
              </p>
            </div>
            <div className="flex gap-2">
              {tracks.length > 0 && (
                <>
                  <button
                    onClick={() => handlePlayAll(false)}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-full flex items-center gap-2 hover:bg-primary/90 active:scale-95 transition-all text-sm shadow-md"
                  >
                    <Play className="h-4 w-4 ml-0.5" /> Play All
                  </button>
                  <button
                    onClick={() => handlePlayAll(true)}
                    className="px-4 py-2 border rounded-full flex items-center gap-2 hover:bg-accent active:scale-95 transition-all text-sm"
                  >
                    <Shuffle className="h-4 w-4" /> Shuffle
                  </button>
                </>
              )}
              <button
                onClick={() => handleDelete(selectedPlaylist.id)}
                className="px-3 py-2 border rounded-full flex items-center gap-1 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 active:scale-95 transition-all text-sm text-muted-foreground"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {tracks.length === 0 ? (
            <div className="text-muted-foreground text-center py-12 text-sm">This playlist is empty</div>
          ) : (
            <div className="space-y-0.5">
              {tracks.map((track, index) => (
                <div key={`${track.id}-${index}`} className="group/track relative">
                  <TrackRow track={track} index={index} allTracks={tracks} showAlbum={false} />
                  <button
                    onClick={() => handleRemoveTrack(index)}
                    className={cn(
                      'absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md transition-all',
                      'opacity-0 group-hover/track:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                    )}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
