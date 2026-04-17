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
});
