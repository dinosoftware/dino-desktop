const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
let discordRpc = null;
let discordClientId = '';

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

  ipcMain.handle('discord-connect', (_e, inputClientId) => {
    const clientId = inputClientId || '797506661857099858';
    try {
      const { Client } = require('@xhayper/discord-rpc');
      if (discordRpc && discordClientId === clientId) return;
      if (discordRpc) { try { discordRpc.destroy(); } catch {} }
      const client = new Client({ clientId });
      client.login().then(() => {
        discordRpc = client;
        discordClientId = clientId;
        console.log('Discord RPC connected:', clientId);
      }).catch((err) => { console.warn('Discord RPC login failed:', err.message); });
    } catch (err) { console.warn('Discord RPC require failed:', err.message); }
  });

  ipcMain.handle('discord-update-presence', (_e, args) => {
    if (!discordRpc) return;
    const activity = {
      type: Number(args.activityType) || 2,
      details: String(args.details || ''),
      state: String(args.state || ''),
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
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'Dino Desktop',
    width: 1280,
    height: 800,
    minWidth: 600,
    minHeight: 500,
    backgroundColor: '#1b1b1d',
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
}

app.whenReady().then(() => {
  setupIpc();
  createWindow();
  app.on('activate', () => { if (!mainWindow) createWindow(); });
});

app.on('window-all-closed', () => {
  if (discordRpc) { try { discordRpc.destroy(); } catch {} }
  app.quit();
});
