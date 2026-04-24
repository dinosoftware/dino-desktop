const { app, BrowserWindow, ipcMain, dialog, shell, Menu, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');
let discordRpc = null;
let discordClientId = '';

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,MediaSessionService');
}

class MpvPlayer {
  constructor() {
    this.proc = null;
    this.reqId = 0;
    this.pending = new Map();
    this.observed = new Set();
    this.props = {};
    this.onEvent = null;
    this.buffer = '';
  }

  async start() {
    if (this.proc) return;
    const sockPath = path.join(app.getPath('userData'), 'mpv.sock');
    try { fs.unlinkSync(sockPath); } catch {}
    this.proc = spawn('mpv', [
      '--idle=yes',
      '--no-video',
      `--input-ipc-server=${sockPath}`,
      '--audio-buffer=0.5',
      '--gapless-audio=yes',
      '--prefetch-playlist=yes',
      '--demuxer-readahead-secs=3',
      '--pause=no',
      '--volume=100',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    this.proc.on('error', (err) => { console.error('mpv spawn error:', err); this.proc = null; });
    this.proc.on('exit', (code) => { console.log('mpv exited with code:', code); this.proc = null; });
    this.proc.stdout.on('data', (d) => { console.log('mpv stdout:', d.toString().trim()); });
    this.proc.stderr.on('data', (d) => { console.log('mpv stderr:', d.toString().trim()); });
    await new Promise(r => setTimeout(r, 300));
    return new Promise((resolve, reject) => {
      const tryConnect = (attempts) => {
        if (attempts <= 0) return reject(new Error('mpv socket not found'));
        if (fs.existsSync(sockPath)) {
          const net = require('net');
          this.sock = net.createConnection(sockPath);
          this.sock.on('data', (d) => this._onData(d));
          this.sock.on('error', (err) => { console.error('mpv socket error:', err); this.sock = null; });
          this.sock.on('close', () => { console.log('mpv socket closed'); this.sock = null; });
          console.log('mpv connected via socket');
          resolve();
        } else {
          setTimeout(() => tryConnect(attempts - 1), 100);
        }
      };
      tryConnect(30);
    });
  }

  _onData(data) {
    this.buffer += data.toString();
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.event === 'log-message') continue;
        if (msg.id != null) {
          const p = this.pending.get(msg.id);
          if (p) {
            this.pending.delete(msg.id);
            if (msg.error && msg.error !== 'success') { p.reject(new Error(msg.error)); }
            else { p.resolve(msg.data); }
          }
        }
        if (msg.event) this._handleEvent(msg);
      } catch (e) { console.error('mpv parse error:', e, line); }
    }
  }

  _handleEvent(msg) {
    if (msg.event === 'property-change' && msg.name) {
      this.props[msg.name] = msg.data;
    }
    if (this.onEvent) this.onEvent(msg);
  }

  async command(cmd, args) {
    if (!this.sock) throw new Error('mpv not connected');
    const id = ++this.reqId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const payload = JSON.stringify({ command: [cmd, ...(args || [])], request_id: id }) + '\n';
      this.sock.write(payload);
    });
  }

  async observe(name) {
    if (this.observed.has(name)) return;
    this.observed.add(name);
    await this.command('observe_property', [this.observed.size, name]);
  }

  async loadFile(url, opts) {
    const append = opts?.append ? 1 : 0;
    const args = [url, append ? 'append-play' : 'replace'];
    if (opts?.options) args.push(JSON.stringify(opts.options));
    console.log('mpv loadFile args:', JSON.stringify(args));
    try {
      const res = await this.command('loadfile', args);
      console.log('mpv loadFile result:', res);
      return res;
    } catch (e) {
      console.error('mpv loadFile error:', e);
      throw e;
    }
  }

  async stop() { await this.command('stop'); }
  async setPause(v) { await this.command('set_property', ['pause', v]); }
  async seekPos(v) { await this.command('seek', [v, 'absolute']); }
  async setVol(v) { await this.command('set_property', ['volume', v * 100]); }
  async getTimePos() { return this.props['time-pos'] ?? 0; }
  async getDuration() { return this.props['duration'] ?? 0; }
  async getPause() { return this.props['pause'] ?? true; }
  async playlistNext() { await this.command('playlist-next'); }
  async playlistClear() { await this.command('playlist-clear'); }
  async playlistRemove(idx) { await this.command('playlist-remove', [idx]); }

  destroy() {
    if (this.sock) { try { this.sock.destroy(); } catch {} this.sock = null; }
    if (this.proc) { try { this.proc.kill('SIGKILL'); } catch {} this.proc = null; }
  }
}

let mpv = null;

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

let updateInfo = null;
let downloadProgress = null;

function configDir() {
  const dir = path.join(app.getPath('userData'), 'dino-desktop');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function readConfigFile(name) {
  try {
    return fs.readFileSync(path.join(configDir(), name), 'utf-8');
  } catch {
    return null;
  }
}

function writeConfigFile(name, data) {
  fs.writeFileSync(path.join(configDir(), name), data, 'utf-8');
}

let mprisPlayer = null;

function setupMpris() {
  if (process.platform !== 'linux') return;
  try {
    const Player = require('mpris-service');

    mprisPlayer = new Player({
      name: 'DinoDesktop',
      identity: 'Dino Desktop',
      supportedMimeTypes: ['audio/mpeg', 'application/ogg', 'audio/flac'],
      supportedInterfaces: ['player'],
    });

    mprisPlayer.canQuit = true;
    mprisPlayer.canRaise = true;
    mprisPlayer.canSetFullscreen = false;
    mprisPlayer.hasTrackList = false;
    mprisPlayer.desktopEntry = 'dino-desktop';
    mprisPlayer.supportedUriSchemes = ['file'];

    mprisPlayer.canControl = true;
    mprisPlayer.canPlay = true;
    mprisPlayer.canPause = true;
    mprisPlayer.canSeek = true;
    mprisPlayer.canGoNext = true;
    mprisPlayer.canGoPrevious = true;
    mprisPlayer.playbackStatus = 'Stopped';
    mprisPlayer.volume = 1.0;
    mprisPlayer.rate = 1.0;
    mprisPlayer.minimumRate = 1.0;
    mprisPlayer.maximumRate = 1.0;
    mprisPlayer.loopStatus = 'None';
    mprisPlayer.shuffle = false;

    mprisPlayer.getPosition = function () {
      return Math.round((mprisPlayer._positionSec || 0) * 1e6);
    };

    mprisPlayer.on('raise', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });
    mprisPlayer.on('quit', () => app.quit());
    mprisPlayer.on('next', () => { if (mainWindow) mainWindow.webContents.send('mpris-next'); });
    mprisPlayer.on('previous', () => { if (mainWindow) mainWindow.webContents.send('mpris-previous'); });
    mprisPlayer.on('pause', () => { if (mainWindow) mainWindow.webContents.send('mpris-pause'); });
    mprisPlayer.on('playpause', () => { if (mainWindow) mainWindow.webContents.send('mpris-playpause'); });
    mprisPlayer.on('stop', () => { if (mainWindow) mainWindow.webContents.send('mpris-stop'); });
    mprisPlayer.on('play', () => { if (mainWindow) mainWindow.webContents.send('mpris-play'); });
    mprisPlayer.on('seek', (offset) => { if (mainWindow) mainWindow.webContents.send('mpris-seek', { offset: offset / 1e6 }); });
    mprisPlayer.on('position', (data) => { if (mainWindow) mainWindow.webContents.send('mpris-set-position', { position: data.position / 1e6 }); });
    mprisPlayer.on('volume', (vol) => { if (mainWindow) mainWindow.webContents.send('mpris-volume', { volume: Math.round(vol * 100) }); });

    mprisPlayer.on('error', (err) => {
      console.warn('MPRIS error:', err.message);
    });

    console.log('MPRIS service initialized');
  } catch (err) {
    console.warn('MPRIS init failed:', err.message);
    mprisPlayer = null;
  }
}

function setupIpc() {
  ipcMain.handle('get-servers', () => readConfigFile('servers.json') || '[]');
  ipcMain.handle('save-servers', (_e, json) => writeConfigFile('servers.json', json));
  ipcMain.handle('get-last-server-id', () => readConfigFile('last_server.txt') || '');
  ipcMain.handle('set-last-server-id', (_e, id) => writeConfigFile('last_server.txt', id));
  ipcMain.handle('save-queue', (_e, json) => writeConfigFile('queue.json', json));
  ipcMain.handle('load-queue', () => readConfigFile('queue.json') || '');

  ipcMain.handle('show-open-dialog', (_e, opts) =>
    dialog.showOpenDialog({ title: opts.title, defaultPath: opts.defaultPath, properties: ['openDirectory'] }).then(r => r.canceled ? '' : r.filePaths[0])
  );
  ipcMain.handle('show-save-dialog', (_e, opts) =>
    dialog.showSaveDialog({ title: opts.title, defaultPath: opts.defaultPath }).then(r => r.canceled ? '' : r.filePath)
  );
  ipcMain.handle('open-external', (_e, url) => shell.openExternal(url));

  ipcMain.handle('minimize-window', () => { if (mainWindow) mainWindow.minimize(); });
  ipcMain.handle('maximize-window', () => { if (mainWindow) mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize(); });
  ipcMain.handle('close-window', () => { if (mainWindow) mainWindow.close(); });
  ipcMain.handle('is-window-maximized', () => mainWindow ? mainWindow.isMaximized() : false);

  ipcMain.handle('write-clipboard', (_e, text) => { require('electron').clipboard.writeText(text); });

  ipcMain.handle('discord-connect', async (_e, inputClientId) => {
    const clientId = inputClientId || '797506661857099858';
    try {
      const { Client } = require('@xhayper/discord-rpc');
      if (discordRpc && discordClientId === clientId) return;
      if (discordRpc) { try { discordRpc.destroy(); } catch {} }
      const client = new Client({ clientId });
      await client.login();
      discordRpc = client;
      discordClientId = clientId;
      console.log('Discord RPC connected:', clientId);
    } catch (err) { console.warn('Discord RPC connect failed:', err.message); }
  });

  ipcMain.handle('discord-update-presence', (_e, args) => {
    if (!discordRpc) return;
    const activity = {
      type: Number(args.activityType) || 2,
      details: String(args.details || ''),
      state: String(args.state || ''),
      statusDisplayType: args.statusDisplayType != null ? Number(args.statusDisplayType) : 0,
    };
    if (args.largeImage) activity.largeImageKey = String(args.largeImage);
    if (args.largeText) activity.largeImageText = String(args.largeText);
    if (args.smallImage) activity.smallImageKey = String(args.smallImage);
    if (args.smallText) activity.smallImageText = String(args.smallText);
    if (args.showTimestamps && args.startMs > 0) {
      activity.startTimestamp = Math.floor(args.startMs);
      if (args.endMs > 0) activity.endTimestamp = Math.floor(args.endMs);
    }
    if (args.showButtons && args.buttonLabel && args.buttonUrl) {
      activity.buttons = [{ label: String(args.buttonLabel), url: String(args.buttonUrl) }];
    }
    discordRpc.user?.setActivity(activity).catch((err) => { console.warn('Discord setActivity failed:', err.message); });
  });

  ipcMain.handle('discord-clear-presence', () => {
    if (discordRpc) {
      try { discordRpc.user?.clearActivity().catch(() => {}); } catch {}
    }
  });

  ipcMain.handle('updater-check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      if (result) {
        const current = app.getVersion().replace(/^v/, '');
        const remote = (result.updateInfo.version || '').replace(/^v/, '');
        const partsA = current.split('.').map(Number);
        const partsB = remote.split('.').map(Number);
        let isNewer = false;
        for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
          const a = partsA[i] || 0;
          const b = partsB[i] || 0;
          if (b > a) { isNewer = true; break; }
          if (b < a) { break; }
        }
        if (!isNewer) {
          updateInfo = null;
          return { available: false, info: null };
        }
        updateInfo = {
          version: result.updateInfo.version,
          releaseDate: result.updateInfo.releaseDate,
          releaseName: result.updateInfo.releaseName || result.updateInfo.version,
          releaseNotes: result.updateInfo.releaseNotes,
        };
        return { available: true, info: updateInfo };
      }
      updateInfo = null;
      return { available: false, info: null };
    } catch (err) {
      return { available: false, error: err.message };
    }
  });

  ipcMain.handle('updater-download', () => {
    return new Promise((resolve, reject) => {
      if (!updateInfo) return reject(new Error('No update available'));
      downloadProgress = { bytesPerSecond: 0, percent: 0, transferred: 0, total: 0 };
      autoUpdater.downloadUpdate();
      resolve();
    });
  });

  ipcMain.handle('updater-install', () => {
    autoUpdater.quitAndInstall(false, true);
  });

  ipcMain.handle('updater-get-progress', () => {
    return downloadProgress;
  });

  ipcMain.handle('updater-can-auto-update', () => {
    if (process.platform === 'win32') return true;
    if (process.platform === 'darwin') return false;
    return Boolean(process.env.APPIMAGE);
  });

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('relaunch-app', () => {
    app.relaunch();
    app.exit(0);
  });

  ipcMain.handle('mpv-detect', async () => {
    return new Promise((resolve) => {
      const p = spawn('mpv', ['--version'], { stdio: 'pipe' });
      p.on('error', () => resolve(false));
      p.on('exit', (code) => resolve(code === 0));
    });
  });

  ipcMain.handle('mpv-start', async () => {
    try {
      if (!mpv) {
        mpv = new MpvPlayer();
        console.log('Starting mpv...');
        await mpv.start();
        console.log('mpv started, observing properties...');
        await mpv.observe('time-pos');
        await mpv.observe('duration');
        await mpv.observe('pause');
        await mpv.observe('idle-active');
        console.log('mpv ready');
        mpv.onEvent = (msg) => {
          if (!mainWindow) return;
          if (msg.event === 'property-change') {
            mainWindow.webContents.send('mpv-property', { name: msg.name, data: msg.data });
          }
          if (msg.event === 'end-file') {
            console.log('mpv end-file:', JSON.stringify(msg));
            mainWindow.webContents.send('mpv-end-file', { reason: msg.reason });
          }
        };
      }
      return true;
    } catch { return false; }
  });

  ipcMain.handle('mpv-stop', () => {
    if (mpv) { mpv.destroy(); mpv = null; }
  });

  ipcMain.handle('mpv-load', async (_e, url, opts) => {
    if (!mpv) throw new Error('mpv not initialized');
    console.log('mpv-load:', url?.substring(0, 80), opts);
    if (!mpv.sock) {
      console.log('mpv-load: socket not ready, waiting...');
      await new Promise(r => setTimeout(r, 500));
      if (!mpv.sock) throw new Error('mpv not connected');
    }
    mpv.loadFile(url, opts).catch((e) => console.error('mpv-load error:', e));
  });
  ipcMain.handle('mpv-set-pause', (_e, v) => { if (mpv) mpv.setPause(v).catch(() => {}); });
  ipcMain.handle('mpv-seek', (_e, v) => { if (mpv) mpv.seekPos(v).catch(() => {}); });
  ipcMain.handle('mpv-set-volume', (_e, v) => { if (mpv) mpv.setVol(v).catch(() => {}); });
  ipcMain.handle('mpv-get-time', () => mpv?.props['time-pos'] ?? 0);
  ipcMain.handle('mpv-get-duration', () => mpv?.props['duration'] ?? 0);
  ipcMain.handle('mpv-playlist-next', () => { if (mpv) mpv.playlistNext().catch(() => {}); });
  ipcMain.handle('mpv-stop-playback', () => { if (mpv) mpv.stop().catch(() => {}); });
  ipcMain.handle('mpv-playlist-clear', () => { if (mpv) mpv.playlistClear().catch(() => {}); });

  ipcMain.on('mpris-update-metadata', (_e, data) => {
    if (!mprisPlayer) return;
    const trackId = data.id ? `/org/mpris/MediaPlayer2/TrackList/${String(data.id).replace(/-/g, '')}` : '/org/mpris/MediaPlayer2/TrackList/0';
    mprisPlayer.metadata = {
      'mpris:trackid': trackId,
      'mpris:length': data.duration ? Math.round(data.duration * 1e6) : 0,
      'mpris:artUrl': data.artworkUrl || '',
      'xesam:title': data.title || '',
      'xesam:artist': data.artist ? [data.artist] : [],
      'xesam:album': data.album || '',
    };
  });

  ipcMain.on('mpris-update-playback', (_e, status) => {
    if (mprisPlayer) mprisPlayer.playbackStatus = status;
  });

  ipcMain.on('mpris-update-position', (_e, positionSec) => {
    if (mprisPlayer) mprisPlayer._positionSec = positionSec;
  });

  ipcMain.on('mpris-update-volume', (_e, volume) => {
    if (mprisPlayer) mprisPlayer.volume = volume / 100;
  });

  ipcMain.on('mpris-seeked', (_e, positionSec) => {
    if (mprisPlayer) mprisPlayer.seeked(Math.round(positionSec * 1e6));
  });
}

autoUpdater.on('download-progress', (info) => {
  downloadProgress = {
    bytesPerSecond: info.bytesPerSecond,
    percent: info.percent,
    transferred: info.transferred,
    total: info.total,
  };
  if (mainWindow) {
    mainWindow.webContents.send('updater-download-progress', downloadProgress);
  }
});

autoUpdater.on('update-downloaded', () => {
  downloadProgress = null;
  if (mainWindow) {
    mainWindow.webContents.send('updater-download-complete');
  }
});

autoUpdater.on('error', (err) => {
  console.warn('Auto-updater error:', err.message);
  downloadProgress = null;
  if (mainWindow) {
    mainWindow.webContents.send('updater-error', err.message);
  }
});

let mainWindow = null;

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'Dino Desktop',
    width: 1280,
    height: 800,
    minWidth: 600,
    minHeight: 500,
    backgroundColor: '#1b1b1d',
    icon: path.join(__dirname, 'frontend', 'dist', 'favicon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.setMenu(null);
}

app.whenReady().then(() => {
  setupMpris();
  setupIpc();
  createWindow();
  autoUpdater.checkForUpdates().catch(() => {});
  app.on('activate', () => { if (!mainWindow) createWindow(); });
});

app.on('before-quit', () => {
  if (mpv) { mpv.destroy(); mpv = null; }
});

app.on('window-all-closed', () => {
  if (mpv) { mpv.destroy(); mpv = null; }
  if (discordRpc) { try { discordRpc.destroy(); } catch {} }
  app.quit();
});
