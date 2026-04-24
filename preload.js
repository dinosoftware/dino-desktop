const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getServers: () => ipcRenderer.invoke('get-servers'),
  saveServers: (json) => ipcRenderer.invoke('save-servers', json),
  getLastServerId: () => ipcRenderer.invoke('get-last-server-id'),
  setLastServerId: (id) => ipcRenderer.invoke('set-last-server-id', id),
  saveQueue: (json) => ipcRenderer.invoke('save-queue', json),
  loadQueue: () => ipcRenderer.invoke('load-queue'),

  showOpenDialog: (opts) => ipcRenderer.invoke('show-open-dialog', opts),
  showSaveDialog: (opts) => ipcRenderer.invoke('show-save-dialog', opts),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  discordConnect: (clientId) => ipcRenderer.invoke('discord-connect', clientId),
  discordUpdatePresence: (args) => ipcRenderer.invoke('discord-update-presence', args),
  discordClearPresence: () => ipcRenderer.invoke('discord-clear-presence'),

  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  isWindowMaximized: () => ipcRenderer.invoke('is-window-maximized'),
  writeClipboard: (text) => ipcRenderer.invoke('write-clipboard', text),

  updaterCheck: () => ipcRenderer.invoke('updater-check'),
  updaterDownload: () => ipcRenderer.invoke('updater-download'),
  updaterInstall: () => ipcRenderer.invoke('updater-install'),
  updaterGetProgress: () => ipcRenderer.invoke('updater-get-progress'),
  updaterCanAutoUpdate: () => ipcRenderer.invoke('updater-can-auto-update'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  onUpdaterDownloadProgress: (cb) => {
    ipcRenderer.on('updater-download-progress', (_e, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('updater-download-progress');
  },
  onUpdaterDownloadComplete: (cb) => {
    ipcRenderer.on('updater-download-complete', () => cb());
    return () => ipcRenderer.removeAllListeners('updater-download-complete');
  },
  onUpdaterError: (cb) => {
    ipcRenderer.on('updater-error', (_e, msg) => cb(msg));
    return () => ipcRenderer.removeAllListeners('updater-error');
  },

  mpvDetect: () => ipcRenderer.invoke('mpv-detect'),
  mpvStart: () => ipcRenderer.invoke('mpv-start'),
  mpvStop: () => ipcRenderer.invoke('mpv-stop'),
  mpvLoad: (url, opts) => ipcRenderer.invoke('mpv-load', url, opts),
  mpvSetPause: (v) => ipcRenderer.invoke('mpv-set-pause', v),
  mpvSeek: (v) => ipcRenderer.invoke('mpv-seek', v),
  mpvSetVolume: (v) => ipcRenderer.invoke('mpv-set-volume', v),
  mpvGetTime: () => ipcRenderer.invoke('mpv-get-time'),
  mpvGetDuration: () => ipcRenderer.invoke('mpv-get-duration'),
  mpvPlaylistNext: () => ipcRenderer.invoke('mpv-playlist-next'),
  mpvStopPlayback: () => ipcRenderer.invoke('mpv-stop-playback'),
  mpvPlaylistClear: () => ipcRenderer.invoke('mpv-playlist-clear'),

  relaunchApp: () => ipcRenderer.invoke('relaunch-app'),

  onMpvProperty: (cb) => {
    ipcRenderer.on('mpv-property', (_e, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('mpv-property');
  },
  onMpvEndFile: (cb) => {
    ipcRenderer.on('mpv-end-file', (_e, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('mpv-end-file');
  },

  mprisUpdateMetadata: (data) => ipcRenderer.send('mpris-update-metadata', data),
  mprisUpdatePlayback: (status) => ipcRenderer.send('mpris-update-playback', status),
  mprisUpdatePosition: (positionSec) => ipcRenderer.send('mpris-update-position', positionSec),
  mprisUpdateVolume: (volume) => ipcRenderer.send('mpris-update-volume', volume),
  mprisSeeked: (positionSec) => ipcRenderer.send('mpris-seeked', positionSec),

  onMprisPlay: (cb) => {
    ipcRenderer.on('mpris-play', () => cb());
    return () => ipcRenderer.removeAllListeners('mpris-play');
  },
  onMprisPause: (cb) => {
    ipcRenderer.on('mpris-pause', () => cb());
    return () => ipcRenderer.removeAllListeners('mpris-pause');
  },
  onMprisPlayPause: (cb) => {
    ipcRenderer.on('mpris-playpause', () => cb());
    return () => ipcRenderer.removeAllListeners('mpris-playpause');
  },
  onMprisNext: (cb) => {
    ipcRenderer.on('mpris-next', () => cb());
    return () => ipcRenderer.removeAllListeners('mpris-next');
  },
  onMprisPrevious: (cb) => {
    ipcRenderer.on('mpris-previous', () => cb());
    return () => ipcRenderer.removeAllListeners('mpris-previous');
  },
  onMprisStop: (cb) => {
    ipcRenderer.on('mpris-stop', () => cb());
    return () => ipcRenderer.removeAllListeners('mpris-stop');
  },
  onMprisSeek: (cb) => {
    ipcRenderer.on('mpris-seek', (_e, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('mpris-seek');
  },
  onMprisSetPosition: (cb) => {
    ipcRenderer.on('mpris-set-position', (_e, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('mpris-set-position');
  },
  onMprisVolume: (cb) => {
    ipcRenderer.on('mpris-volume', (_e, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('mpris-volume');
  },
});
