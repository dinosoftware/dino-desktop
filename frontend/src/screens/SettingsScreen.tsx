import { useAuthStore } from '@/stores';
import { useTheme } from '@/hooks';
import { usePlatform } from '@/platform';
import { Sun, Moon, Monitor, LogOut, Server, Trash2, Wifi, Speaker, Palette, Info, Plus, Pencil, Check, X, Gamepad2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { apiClient } from '@/api/client';
import { refreshDiscordPresence, connectDiscordRPC, refreshWakeLock } from '@/stores/playerStore';

type StreamingQuality = '0' | '64' | '96' | '128' | '192' | '256' | '320' | 'max';
type StreamingFormat = 'raw' | 'mp3' | 'opus' | 'aac' | 'flac';

const QUALITY_OPTIONS: { value: StreamingQuality; label: string }[] = [
  { value: '0', label: 'Unlimited' },
  { value: '64', label: '64 kbps' },
  { value: '96', label: '96 kbps' },
  { value: '128', label: '128 kbps' },
  { value: '192', label: '192 kbps' },
  { value: '256', label: '256 kbps' },
  { value: '320', label: '320 kbps' },
  { value: 'max', label: 'Original' },
];

const FORMAT_OPTIONS: { value: StreamingFormat; label: string }[] = [
  { value: 'raw', label: 'Original' },
  { value: 'mp3', label: 'MP3' },
  { value: 'opus', label: 'Opus' },
  { value: 'aac', label: 'AAC' },
  { value: 'flac', label: 'FLAC' },
];

function getSetting<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function setSetting(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function SettingsScreen() {
  const { servers, currentServerId, logout, removeServer } = useAuthStore();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const platform = usePlatform();

  const [streamingQuality, setStreamingQuality] = useState<StreamingQuality>(
    getSetting('dino_quality', 'max')
  );
  const [streamingFormat, setStreamingFormat] = useState<StreamingFormat>(
    getSetting('dino_format', 'raw')
  );
  const [scrobbleEnabled, setScrobbleEnabled] = useState(
    getSetting('dino_scrobble', true)
  );
  const [gaplessPlayback, setGaplessPlayback] = useState(
    getSetting('dino_gapless', true)
  );
  const [wakeLock, setWakeLock] = useState(
    getSetting('dino_wake_lock', false)
  );
  const [autoExtend, setAutoExtend] = useState(
    getSetting('dino_auto_extend', true)
  );
  const [autoExtendThreshold, setAutoExtendThreshold] = useState<number>(
    getSetting('dino_auto_extend_threshold', 1)
  );
  const [discordRpc, setDiscordRpc] = useState(
    getSetting('dino_discord_rpc', false)
  );
  const [discordRpcPaused, setDiscordRpcPaused] = useState(
    getSetting('dino_discord_rpc_paused', true)
  );
  const [discordRpcDisplay, setDiscordRpcDisplay] = useState<number>(
    getSetting('dino_discord_rpc_display', 0)
  );
  const [discordRpcClientId, setDiscordRpcClientId] = useState<string>(
    getSetting('dino_discord_rpc_client_id', '797506661857099858')
  );
  const [discordRpcActivityType, setDiscordRpcActivityType] = useState<number>(
    getSetting('dino_discord_rpc_activity_type', 2)
  );
  const [discordRpcShowTime, setDiscordRpcShowTime] = useState(
    getSetting('dino_discord_rpc_show_time', true)
  );
  const [discordRpcImagePriority, setDiscordRpcImagePriority] = useState<string>(
    getSetting('dino_discord_rpc_image_priority', 'server')
  );
  const [discordRpcLastfmKey, setDiscordRpcLastfmKey] = useState<string>(
    getSetting('dino_discord_rpc_lastfm_key', '')
  );

  const handleQualityChange = (q: StreamingQuality) => {
    setStreamingQuality(q);
    setSetting('dino_quality', q);
  };

  const handleFormatChange = (f: StreamingFormat) => {
    setStreamingFormat(f);
    setSetting('dino_format', f);
  };

  const handleScrobbleToggle = () => {
    const next = !scrobbleEnabled;
    setScrobbleEnabled(next);
    setSetting('dino_scrobble', next);
  };

  const handleGaplessToggle = () => {
    const next = !gaplessPlayback;
    setGaplessPlayback(next);
    setSetting('dino_gapless', next);
  };

  const handleWakeLockToggle = () => {
    const next = !wakeLock;
    setWakeLock(next);
    setSetting('dino_wake_lock', next);
    refreshWakeLock();
  };

  const handleAutoExtendToggle = () => {
    const next = !autoExtend;
    setAutoExtend(next);
    setSetting('dino_auto_extend', next);
  };

  const handleAutoExtendThreshold = (v: number) => {
    setAutoExtendThreshold(v);
    setSetting('dino_auto_extend_threshold', v);
  };

  const handleDiscordRpcToggle = () => {
    const next = !discordRpc;
    setDiscordRpc(next);
    setSetting('dino_discord_rpc', next);
    if (next) connectDiscordRPC().then(() => refreshDiscordPresence());
    else refreshDiscordPresence();
  };

  const handleDiscordRpcPausedToggle = () => {
    const next = !discordRpcPaused;
    setDiscordRpcPaused(next);
    setSetting('dino_discord_rpc_paused', next);
    refreshDiscordPresence();
  };

  const handleDiscordRpcDisplay = (v: number) => {
    setDiscordRpcDisplay(v);
    setSetting('dino_discord_rpc_display', v);
    connectDiscordRPC().then(() => refreshDiscordPresence());
  };

  const handleDiscordRpcClientId = (v: string) => {
    setDiscordRpcClientId(v);
    setSetting('dino_discord_rpc_client_id', v);
    connectDiscordRPC().then(() => refreshDiscordPresence());
  };

  const handleDiscordRpcActivityType = (v: number) => {
    setDiscordRpcActivityType(v);
    setSetting('dino_discord_rpc_activity_type', v);
    refreshDiscordPresence();
  };

  const handleDiscordRpcShowTimeToggle = () => {
    const next = !discordRpcShowTime;
    setDiscordRpcShowTime(next);
    setSetting('dino_discord_rpc_show_time', next);
    refreshDiscordPresence();
  };

  const handleDiscordRpcImagePriority = (v: string) => {
    setDiscordRpcImagePriority(v);
    setSetting('dino_discord_rpc_image_priority', v);
    refreshDiscordPresence(true);
  };

  const handleDiscordRpcLastfmKey = (v: string) => {
    setDiscordRpcLastfmKey(v);
    setSetting('dino_discord_rpc_lastfm_key', v);
    refreshDiscordPresence(true);
  };

  const [showAddServer, setShowAddServer] = useState(false);
  const [newServer, setNewServer] = useState({ name: '', url: '', username: '', password: '' });
  const [addError, setAddError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const { addServer } = useAuthStore();

  const handleAddServer = async () => {
    setTesting(true);
    setAddError(null);
    const ok = await addServer(newServer);
    setTesting(false);
    if (ok) {
      setShowAddServer(false);
      setNewServer({ name: '', url: '', username: '', password: '' });
    } else {
      setAddError('Failed to connect. Check your credentials.');
    }
  };

  const [editingServer, setEditingServer] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const startEditName = (id: string, name: string) => {
    setEditingServer(id);
    setEditName(name);
  };

  const saveEditName = async (id: string) => {
    const updated = servers.map(s => s.id === id ? { ...s, name: editName } : s);
    await platform.saveServers(updated);
    useAuthStore.setState({ servers: updated });
    setEditingServer(null);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8 animate-fade-in">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

      {/* SERVER MANAGEMENT */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Servers</h2>
        </div>
        {servers.map((server) => (
          <div
            key={server.id}
            className={cn(
              'p-4 rounded-xl border bg-card flex items-center justify-between gap-4 transition-all',
              server.id === currentServerId && 'border-primary'
            )}
            style={server.id === currentServerId ? { borderColor: 'var(--cover-ring)', backgroundColor: 'var(--album-header-bg)' } : {}}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className={cn(
                'h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0',
                server.id === currentServerId ? 'bg-accent text-primary' : 'bg-muted text-muted-foreground'
              )}>
                <Server className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                {editingServer === server.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="bg-muted rounded-md px-2 py-1 text-sm border-none outline-none focus:ring-1 focus:ring-primary"
                      onKeyDown={(e) => e.key === 'Enter' && saveEditName(server.id)}
                    />
                    <button onClick={() => saveEditName(server.id)} className="p-1 text-green-500 hover:bg-accent rounded"><Check className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setEditingServer(null)} className="p-1 text-muted-foreground hover:bg-accent rounded"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ) : (
                  <div className="font-medium text-sm truncate">{server.name}</div>
                )}
                <div className="text-xs text-muted-foreground truncate">{server.url}</div>
                <div className="text-xs text-muted-foreground">{server.username}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {server.id === currentServerId && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--toggle-on)', color: 'var(--toggle-on-knob)' }}>Active</span>
              )}
              {server.id !== currentServerId && (
                <button
                  onClick={async () => {
                    const { login } = useAuthStore.getState();
                    await login(server.id);
                  }}
                  className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full hover:text-foreground transition-colors"
                >
                  Switch
                </button>
              )}
              <button
                onClick={() => startEditName(server.id, server.name)}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              {servers.length > 1 && (
                <button
                  onClick={() => removeServer(server.id)}
                  className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-md hover:bg-accent"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}

        {showAddServer ? (
          <div className="p-4 rounded-xl border bg-card space-y-3">
            <h3 className="text-sm font-semibold">Add Server</h3>
            <input
              placeholder="Server name"
              value={newServer.name}
              onChange={(e) => setNewServer(p => ({ ...p, name: e.target.value }))}
              className="w-full bg-muted rounded-lg px-3 py-2 text-sm border-none outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              placeholder="Server URL (e.g. https://music.example.com)"
              value={newServer.url}
              onChange={(e) => setNewServer(p => ({ ...p, url: e.target.value }))}
              className="w-full bg-muted rounded-lg px-3 py-2 text-sm border-none outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              placeholder="Username"
              value={newServer.username}
              onChange={(e) => setNewServer(p => ({ ...p, username: e.target.value }))}
              className="w-full bg-muted rounded-lg px-3 py-2 text-sm border-none outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              placeholder="Password"
              type="password"
              value={newServer.password}
              onChange={(e) => setNewServer(p => ({ ...p, password: e.target.value }))}
              className="w-full bg-muted rounded-lg px-3 py-2 text-sm border-none outline-none focus:ring-1 focus:ring-primary"
              onKeyDown={(e) => e.key === 'Enter' && handleAddServer()}
            />
            {addError && <p className="text-xs text-destructive">{addError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleAddServer}
                disabled={testing || !newServer.url || !newServer.username}
                className="px-4 py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{ backgroundColor: 'var(--toggle-on)', color: 'var(--toggle-on-knob)' }}
              >
                {testing ? 'Connecting...' : 'Add Server'}
              </button>
              <button
                onClick={() => { setShowAddServer(false); setAddError(null); }}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-accent transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddServer(true)}
            className="flex items-center gap-2 px-4 py-2.5 border rounded-xl hover:bg-accent transition-colors text-sm text-muted-foreground hover:text-foreground w-full"
          >
            <Plus className="h-4 w-4" /> Add Server
          </button>
        )}

        <button
          onClick={logout}
          className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-accent transition-colors text-sm text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </section>

      {/* STREAMING */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Wifi className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Streaming</h2>
        </div>

        <div className="space-y-4 p-4 rounded-xl border bg-card">
          <div>
            <label className="text-sm font-medium block mb-2">Audio Quality</label>
            <div className="grid grid-cols-4 gap-2">
              {QUALITY_OPTIONS.map((opt) => {
                const selected = streamingQuality === opt.value;
                return (
                  <SelectableButton key={opt.value} selected={selected} onClick={() => handleQualityChange(opt.value)}>
                    {opt.label}
                  </SelectableButton>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium block mb-2">Transcoding Format</label>
            <div className="grid grid-cols-5 gap-2">
              {FORMAT_OPTIONS.map((opt) => {
                const selected = streamingFormat === opt.value;
                return (
                  <SelectableButton key={opt.value} selected={selected} onClick={() => handleFormatChange(opt.value)}>
                    {opt.label}
                  </SelectableButton>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* PLAYBACK */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Speaker className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Playback</h2>
        </div>

        <div className="space-y-3 p-4 rounded-xl border bg-card">
          <ToggleRow
            label="Scrobble plays"
            description="Submit now-playing and scrobble to server"
            checked={scrobbleEnabled}
            onChange={handleScrobbleToggle}
          />
          <ToggleRow
            label="Gapless playback"
            description="Remove silence between tracks"
            checked={gaplessPlayback}
            onChange={handleGaplessToggle}
          />
          <ToggleRow
            label="Prevent sleep while playing"
            description="Keep screen awake during playback"
            checked={wakeLock}
            onChange={handleWakeLockToggle}
          />
          <ToggleRow
            label="Auto-extend queue"
            description="Add similar songs when queue is running low"
            checked={autoExtend}
            onChange={handleAutoExtendToggle}
          />
          {autoExtend && (
            <div className="pl-1 border-l-2 border-primary">
              <label className="text-sm font-medium block mb-1.5">Extend when fewer than</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: 1, label: '1 song' },
                  { value: 2, label: '2 songs' },
                  { value: 3, label: '3 songs' },
                  { value: 5, label: '5 songs' },
                ].map((opt) => (
                  <SelectableButton key={opt.value} selected={autoExtendThreshold === opt.value} onClick={() => handleAutoExtendThreshold(opt.value)}>
                    {opt.label}
                  </SelectableButton>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* INTEGRATIONS — desktop only */}
      {platform.isDesktop && (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Gamepad2 className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Discord Rich Presence</h2>
        </div>

        <div className="space-y-4 p-4 rounded-xl border bg-card">
          <ToggleRow
            label="Enable Discord Presence"
            description="Show what you're listening to on your Discord profile"
            checked={discordRpc}
            onChange={handleDiscordRpcToggle}
          />

          {discordRpc && (
            <div className="space-y-4 pl-1 border-l-2 border-primary">

              <div>
                <label className="text-sm font-medium block mb-1.5">Activity Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <SelectableButton selected={discordRpcActivityType === 2} onClick={() => handleDiscordRpcActivityType(2)}>Listening</SelectableButton>
                  <SelectableButton selected={discordRpcActivityType === 0} onClick={() => handleDiscordRpcActivityType(0)}>Playing</SelectableButton>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1.5">Status Display</label>
                <p className="text-xs text-muted-foreground mb-2">Controls which line gets the "Listening to" / "Playing" prefix</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 0, label: 'App Name' },
                    { value: 1, label: 'Artist' },
                    { value: 2, label: 'Track' },
                  ].map((opt) => (
                    <SelectableButton key={opt.value} selected={discordRpcDisplay === opt.value} onClick={() => handleDiscordRpcDisplay(opt.value)}>
                      {opt.label}
                    </SelectableButton>
                  ))}
                </div>
              </div>

              <ToggleRow label="Show Playback Time" description="Display elapsed/remaining time on Discord" checked={discordRpcShowTime} onChange={handleDiscordRpcShowTimeToggle} />
              <ToggleRow label="Show When Paused" description="Keep presence visible while paused" checked={discordRpcPaused} onChange={handleDiscordRpcPausedToggle} />

              <div>
                <label className="text-sm font-medium block mb-1.5">Image Priority</label>
                <div className="grid grid-cols-2 gap-2">
                  <SelectableButton selected={discordRpcImagePriority === 'server'} onClick={() => handleDiscordRpcImagePriority('server')}>Server First</SelectableButton>
                  <SelectableButton selected={discordRpcImagePriority === 'lastfm'} onClick={() => handleDiscordRpcImagePriority('lastfm')}>Last.fm First</SelectableButton>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1.5">Application Client ID</label>
                <p className="text-xs text-muted-foreground mb-2">Discord application ID for Rich Presence</p>
                <input value={discordRpcClientId} onChange={(e) => handleDiscordRpcClientId(e.target.value)} placeholder="1296556473751609424" className="w-full bg-muted rounded-lg px-3 py-2 text-sm border-none outline-none focus:ring-1 focus:ring-primary font-mono" />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1.5">Last.fm API Key</label>
                <p className="text-xs text-muted-foreground mb-2">Fallback cover art source when server has no album info</p>
                <input value={discordRpcLastfmKey} onChange={(e) => handleDiscordRpcLastfmKey(e.target.value)} placeholder="your_lastfm_api_key" className="w-full bg-muted rounded-lg px-3 py-2 text-sm border-none outline-none focus:ring-1 focus:ring-primary font-mono" />
              </div>
            </div>
          )}
        </div>
      </section>
      )}

      {/* APPEARANCE */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Appearance</h2>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'light' as const, icon: Sun, label: 'Light' },
            { id: 'dark' as const, icon: Moon, label: 'Dark' },
            { id: 'system' as const, icon: Monitor, label: 'System' },
          ].map((t) => {
            const selected = theme === t.id;
            return (
              <SelectableCard key={t.id} selected={selected} onClick={() => setTheme(t.id)}>
                <t.icon className="h-5 w-5" />
                <span className="text-xs font-medium">{t.label}</span>
              </SelectableCard>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Currently using {resolvedTheme === 'dark' ? 'dark' : 'light'} mode
        </p>
      </section>

      {/* ABOUT */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">About</h2>
        </div>
        <div className="p-4 rounded-xl border bg-card text-sm text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Dino Desktop v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}</p>
          <p>A modern music player for OpenSubsonic servers</p>
          <p>Connected to {apiClient.getServerUrl() || 'no server'}</p>
        </div>
      </section>
    </div>
  );
}

function SelectableButton({ selected, onClick, children, className = '' }: { selected: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn('px-3 py-2 rounded-lg text-xs font-medium transition-all border', className)}
      style={{
        borderColor: selected ? 'var(--toggle-on)' : 'var(--toggle-off)',
        backgroundColor: selected ? 'var(--toggle-on)' : 'transparent',
        color: selected ? 'var(--toggle-on-knob)' : 'var(--toggle-off-knob)',
      }}
      onMouseEnter={(e) => { if (!selected) { e.currentTarget.style.backgroundColor = 'hsl(var(--accent))'; e.currentTarget.style.borderColor = 'hsl(var(--border))'; e.currentTarget.style.color = 'hsl(var(--foreground))'; } }}
      onMouseLeave={(e) => { if (!selected) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'var(--toggle-off)'; e.currentTarget.style.color = 'var(--toggle-off-knob)'; } }}
    >
      {children}
    </button>
  );
}

function SelectableCard({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="p-4 rounded-xl border flex flex-col items-center gap-2 transition-all"
      style={{
        borderColor: selected ? 'var(--toggle-on)' : 'var(--toggle-off)',
        backgroundColor: selected ? 'var(--toggle-on)' : 'transparent',
        color: selected ? 'var(--toggle-on-knob)' : 'var(--toggle-off-knob)',
      }}
      onMouseEnter={(e) => { if (!selected) { e.currentTarget.style.backgroundColor = 'hsl(var(--accent))'; e.currentTarget.style.borderColor = 'hsl(var(--border))'; e.currentTarget.style.color = 'hsl(var(--foreground))'; } }}
      onMouseLeave={(e) => { if (!selected) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'var(--toggle-off)'; e.currentTarget.style.color = 'var(--toggle-off-knob)'; } }}
    >
      {children}
    </button>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        onClick={onChange}
        className="w-11 h-6 rounded-full transition-colors relative flex-shrink-0"
        style={{ backgroundColor: checked ? 'var(--toggle-on)' : 'var(--toggle-off)' }}
      >
        <div
          className={cn(
            'absolute top-0.5 w-5 h-5 rounded-full transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          )}
          style={{ backgroundColor: checked ? 'var(--toggle-on-knob)' : 'var(--toggle-off-knob)' }}
        />
      </button>
    </div>
  );
}
