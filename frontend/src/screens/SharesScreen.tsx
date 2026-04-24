import { useState, useEffect } from 'react';
import { apiClient } from '@/api/client';
import { usePlayerStore } from '@/stores';
import { usePlatform } from '@/platform';
import { useToastStore } from '@/stores/toastStore';
import type { Share, Track } from '@/api/types';
import { Trash2, Pencil, ExternalLink, Clock, Eye, Music, Play, Copy } from 'lucide-react';
import { formatTime, getArtistDisplay } from '@/lib/utils';

export function SharesScreen() {
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editExpiry, setEditExpiry] = useState('');
  const playQueue = usePlayerStore((s) => s.playQueue);
  const platform = usePlatform();
  const toast = useToastStore();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await apiClient.getShares();
      if (!cancelled) { setShares(data); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleDelete = async (id: string) => {
    await apiClient.deleteShare(id);
    setShares((s) => s.filter((sh) => sh.id !== id));
  };

  const startEdit = (share: Share) => {
    setEditingId(share.id);
    setEditDesc(share.description || '');
    if (share.expires) {
      const diff = new Date(share.expires).getTime() - Date.now();
      setEditExpiry(diff > 0 ? String(Math.round(diff / 86400000)) : '0');
    } else {
      setEditExpiry('');
    }
  };

  const saveEdit = async (id: string) => {
    const params: { description?: string; expires?: number } = {};
    if (editDesc) params.description = editDesc;
    if (editExpiry !== '') params.expires = parseInt(editExpiry) * 86400000;
    await apiClient.updateShare(id, params);
    setEditingId(null);
    setLoading(true);
    const data = await apiClient.getShares();
    setShares(data);
    setLoading(false);
  };

  const handleCopyUrl = async (url: string) => {
    if (platform.writeClipboard) {
      await platform.writeClipboard(url);
    } else {
      try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
    }
    toast.showToast('Link copied!', 'share');
  };

  const handlePlayAll = (tracks: Track[]) => {
    if (tracks.length > 0) playQueue(tracks);
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-6">Shares</h1>
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
      <h1 className="text-3xl font-bold tracking-tight">Shares</h1>

      {shares.length === 0 ? (
        <p className="text-muted-foreground text-sm">No shares yet. Right-click a track and select "Share" to create one.</p>
      ) : (
        <div className="space-y-3">
          {shares.map((share) => (
            <div key={share.id} className="p-4 rounded-xl border bg-card space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {editingId === share.id ? (
                    <div className="space-y-2">
                      <input
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="Description"
                        className="w-full bg-muted rounded-lg px-3 py-2 text-sm border-none outline-none focus:ring-1 focus:ring-primary"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          value={editExpiry}
                          onChange={(e) => setEditExpiry(e.target.value)}
                          placeholder="Days until expiry (empty = never)"
                          type="number"
                          min="0"
                          className="w-64 bg-muted rounded-lg px-3 py-2 text-sm border-none outline-none focus:ring-1 focus:ring-primary"
                        />
                        <button onClick={() => saveEdit(share.id)} className="px-3 py-2 rounded-lg text-xs font-medium" style={{ backgroundColor: 'var(--toggle-on)', color: 'var(--toggle-on-knob)' }}>Save</button>
                        <button onClick={() => setEditingId(null)} className="px-3 py-2 rounded-lg text-xs font-medium border">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-medium truncate">{share.description || 'Untitled share'}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(share.created).toLocaleDateString()}</span>
                        {share.expires && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Expires {new Date(share.expires).toLocaleDateString()}</span>}
                        <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{share.visitCount} visits</span>
                      </div>
                    </>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <code className="text-xs bg-muted px-2 py-1 rounded truncate max-w-md block">{share.url}</code>
                    <button onClick={() => handleCopyUrl(share.url)} className="p-1 text-muted-foreground hover:text-foreground transition-colors" title="Copy link"><Copy className="h-3.5 w-3.5" /></button>
                    {typeof window !== 'undefined' && window.electronAPI && (
                      <button onClick={() => window.electronAPI?.openExternal?.(share.url)} className="p-1 text-muted-foreground hover:text-foreground transition-colors" title="Open in browser"><ExternalLink className="h-3.5 w-3.5" /></button>
                    )}
                  </div>
                </div>
                {editingId !== share.id && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => startEdit(share)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => handleDelete(share.id)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-md hover:bg-accent"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                )}
              </div>
              {share.entry && share.entry.length > 0 && (
                <div className="border-t pt-2 space-y-0.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{share.entry.length} track{share.entry.length !== 1 ? 's' : ''}</span>
                    <button onClick={() => handlePlayAll(share.entry!)} className="flex items-center gap-1 text-xs text-primary hover:underline"><Play className="h-3 w-3" />Play all</button>
                  </div>
                  {share.entry.slice(0, 5).map((track) => (
                    <div key={track.id} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-accent/50 text-sm">
                      <Music className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="truncate flex-1">{track.title}</span>
                      <span className="text-xs text-muted-foreground truncate">{getArtistDisplay(track).text}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{formatTime(track.duration)}</span>
                    </div>
                  ))}
                  {share.entry.length > 5 && (
                    <p className="text-xs text-muted-foreground px-2">+{share.entry.length - 5} more</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
