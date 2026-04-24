import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { apiClient } from '@/api/client';
import { usePlayerStore } from '@/stores';
import type { Playlist, PlaylistWithSongs, GetPlaylistsResponse, GetPlaylistResponse, Track } from '@/api/types';
import { Music, Play, ListMusic, ArrowLeft, Plus, Shuffle, Trash2, Pencil, Check, X, GripVertical, Save, Share2 } from 'lucide-react';
import { LoadingScreen } from '@/components/ui';
import { TrackRow } from '@/components';
import { formatTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { usePlatform } from '@/platform';
import { useToastStore } from '@/stores/toastStore';

export function PlaylistsScreen() {
  const { playQueue } = usePlayerStore();
  const platform = usePlatform();
  const toast = useToastStore();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistWithSongs | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const [renameValue, setRenameValue] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editComment, setEditComment] = useState('');
  const [editTracks, setEditTracks] = useState<Track[]>([]);
  const [saving, setSaving] = useState(false);

  const dragIndex = useRef<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);

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
    setLoading(true);
    try {
      const data = await apiClient.request<GetPlaylistResponse>('getPlaylist', { id: playlist.id });
      const pl = data.playlist;
      setSelectedPlaylist(pl || null);
      setTracks(pl?.entry || []);
      setEditing(false);
    } catch {
      setSelectedPlaylist({ ...playlist, entry: [] });
      setTracks([]);
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

  const startEditing = useCallback(() => {
    if (!selectedPlaylist) return;
    setEditName(selectedPlaylist.name);
    setEditComment(selectedPlaylist.comment || '');
    setEditTracks([...tracks]);
    setEditing(true);
  }, [selectedPlaylist, tracks]);

  const cancelEditing = useCallback(() => {
    setEditing(false);
  }, []);

  const saveEditing = useCallback(async () => {
    if (!selectedPlaylist) return;
    setSaving(true);

    try {
      const currentIds = tracks.map(t => t.id);
      const newIds = editTracks.map(t => t.id);

      const removedIds = currentIds.filter(id => !newIds.includes(id));
      const toRemove: number[] = [];
      currentIds.forEach((id, i) => {
        if (removedIds.includes(id)) toRemove.push(i);
      });

      const addedIds = newIds.filter(id => !currentIds.includes(id));

      const orderChanged = currentIds.length === newIds.length &&
        currentIds.some((id, i) => id !== newIds[i]);

      if (orderChanged) {
        const allOldIndexes = currentIds.map((_, i) => i);
        await apiClient.updatePlaylist({
          playlistId: selectedPlaylist.id,
          name: editName.trim() !== selectedPlaylist.name ? editName.trim() : undefined,
          comment: editComment !== (selectedPlaylist.comment || '') ? editComment : undefined,
          songIndexesToRemove: allOldIndexes,
        });
        await apiClient.updatePlaylist({
          playlistId: selectedPlaylist.id,
          songIdsToAdd: newIds,
        });
      } else {
        const hasChanges = editName !== selectedPlaylist.name ||
          editComment !== (selectedPlaylist.comment || '') ||
          toRemove.length > 0 || addedIds.length > 0;
        if (hasChanges) {
          await apiClient.updatePlaylist({
            playlistId: selectedPlaylist.id,
            name: editName.trim() !== selectedPlaylist.name ? editName.trim() : undefined,
            comment: editComment !== (selectedPlaylist.comment || '') ? editComment : undefined,
            songIdsToAdd: addedIds.length > 0 ? addedIds : undefined,
            songIndexesToRemove: toRemove.length > 0 ? toRemove : undefined,
          });
        }
      }

      await loadPlaylistTracks({ ...selectedPlaylist, name: editName.trim() });
      await loadPlaylists();
      setEditing(false);
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  }, [selectedPlaylist, tracks, editName, editComment, editTracks]);

  const handleDragStart = useCallback((index: number) => {
    dragIndex.current = index;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragOverIndex.current === index) return;
    dragOverIndex.current = index;
    if (dragIndex.current === null || dragIndex.current === index) return;
    const updated = [...editTracks];
    const [moved] = updated.splice(dragIndex.current, 1);
    updated.splice(index, 0, moved);
    dragIndex.current = index;
    setEditTracks(updated);
  }, [editTracks]);

  const handleDragEnd = useCallback(() => {
    dragIndex.current = null;
    dragOverIndex.current = null;
  }, []);

  const coverUrl = useMemo(() =>
    selectedPlaylist?.coverArt ? apiClient.buildCoverArtUrl(selectedPlaylist.coverArt, 400) : null,
    [selectedPlaylist?.coverArt]
  );

  const headerCoverUrl = useMemo(() =>
    selectedPlaylist?.coverArt ? apiClient.buildCoverArtUrl(selectedPlaylist.coverArt, 600) : null,
    [selectedPlaylist?.coverArt]
  );

  const totalDuration = tracks.reduce((acc, t) => acc + (t.duration || 0), 0);

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
      {!selectedPlaylist ? (
        <>
          <h1 className="text-3xl font-bold tracking-tight">Playlists</h1>
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
                const plCoverUrl = playlist.coverArt ? apiClient.buildCoverArtUrl(playlist.coverArt, 120) : null;
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
                        {plCoverUrl ? (
                          <img src={plCoverUrl} alt={playlist.name} className="w-full h-full object-cover" />
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
                        onClick={async () => {
                          const shareEnabled = (() => { try { const v = localStorage.getItem('dino_shares'); return v ? JSON.parse(v) : true; } catch { return true; } })();
                          if (!shareEnabled) return;
                          const share = await apiClient.createShare([playlist.id], playlist.name);
                          if (share?.url) {
                            if (platform.writeClipboard) { await platform.writeClipboard(share.url); }
                            else { try { await navigator.clipboard.writeText(share.url); } catch { /* ignore */ } }
                            toast.showToast('Link copied!', 'share');
                          }
                        }}
                        className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                      </button>
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
        </>
      ) : (
        <div className="animate-fade-in">
          <div className="relative overflow-hidden -mx-6 -mt-6 px-6 pt-6">
            {headerCoverUrl && (
              <>
                <div className="absolute inset-0 bg-cover bg-center scale-110" style={{ backgroundImage: `url(${headerCoverUrl})`, filter: 'blur(4px)', opacity: 0.3 }} />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent, hsl(var(--background)))' }} />
              </>
            )}
            <div className="relative z-10" style={{ background: headerCoverUrl ? '' : 'linear-gradient(to bottom, var(--album-header-bg), transparent)' }}>
              <div className="max-w-5xl mx-auto">
                <button
                  onClick={() => { setSelectedPlaylist(null); setTracks([]); setEditing(false); }}
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
                      <img src={coverUrl} alt={selectedPlaylist.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, var(--album-header-bg), var(--cover-placeholder-bg))' }}>
                        <ListMusic className="h-16 w-16" style={{ color: 'hsl(var(--primary))', opacity: 0.3 }} />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col justify-end min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>Playlist</p>
                    <h1 className="text-4xl font-bold mb-2 truncate">{selectedPlaylist.name}</h1>
                    {selectedPlaylist.comment && (
                      <p className="text-sm mb-3" style={{ color: 'hsl(var(--muted-foreground))' }}>{selectedPlaylist.comment}</p>
                    )}
                    <div className="mb-4 text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
                      {selectedPlaylist.owner && <span>{selectedPlaylist.owner}</span>}
                      {selectedPlaylist.owner && <span style={{ opacity: 0.5 }} className="mx-2">&middot;</span>}
                      <span>{tracks.length} songs</span>
                      {totalDuration > 0 && (
                        <>
                          <span style={{ opacity: 0.5 }} className="mx-2">&middot;</span>
                          <span>{formatTime(totalDuration)}</span>
                        </>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {!editing && tracks.length > 0 && (
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
                      {!editing ? (
                        <>
                          <button
                            onClick={startEditing}
                            className="px-3 py-2 border rounded-full flex items-center gap-1 hover:bg-accent active:scale-95 transition-all text-sm text-muted-foreground"
                          >
                            <Pencil className="h-4 w-4" /> Edit
                          </button>
                          <button
                            onClick={() => handleDelete(selectedPlaylist.id)}
                            className="px-3 py-2 border rounded-full flex items-center gap-1 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 active:scale-95 transition-all text-sm text-muted-foreground"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={saveEditing}
                            disabled={saving}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-full flex items-center gap-2 hover:bg-primary/90 active:scale-95 transition-all text-sm shadow-md disabled:opacity-50"
                          >
                            <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="px-3 py-2 border rounded-full flex items-center gap-1 hover:bg-accent active:scale-95 transition-all text-sm text-muted-foreground"
                          >
                            <X className="h-4 w-4" /> Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {editing && (
            <div className="max-w-5xl mx-auto space-y-3 mt-4">
              <div>
                <label className="text-xs font-medium block mb-1.5">Name</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-muted rounded-lg px-3 py-2 text-sm border-none outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5">Description</label>
                <input
                  value={editComment}
                  onChange={(e) => setEditComment(e.target.value)}
                  placeholder="Add a description..."
                  className="w-full bg-muted rounded-lg px-3 py-2 text-sm border-none outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <p className="text-xs text-muted-foreground pt-1">Drag tracks to reorder. Click the &times; to remove tracks. Changes are saved when you press Save.</p>
            </div>
          )}

          <div className="max-w-5xl mx-auto">
            {tracks.length === 0 && !editing ? (
              <div className="text-muted-foreground text-center py-12 text-sm">This playlist is empty</div>
            ) : editing ? (
              <div className="space-y-0.5 mt-4">
                {editTracks.map((track, index) => (
                  <div
                    key={`${track.id}-${index}`}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className="group/edit relative flex items-center gap-1"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab active:cursor-grabbing flex-shrink-0" />
                    <div className="flex-1 min-w-0 opacity-80 pointer-events-none">
                      <TrackRow track={track} index={index} allTracks={editTracks} showAlbum={false} />
                    </div>
                    <button
                      onClick={() => {
                        const updated = [...editTracks];
                        updated.splice(index, 1);
                        setEditTracks(updated);
                      }}
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors flex-shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {editTracks.length === 0 && (
                  <div className="text-muted-foreground text-center py-12 text-sm">No tracks in this playlist</div>
                )}
              </div>
            ) : (
              <div className="space-y-0.5 mt-4">
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
        </div>
      )}
    </div>
  );
}
