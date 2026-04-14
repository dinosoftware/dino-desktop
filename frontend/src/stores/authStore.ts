import { create } from 'zustand';
import md5 from 'blueimp-md5';
import type { ServerConfig } from '@/platform/types';
import { usePlatform } from '@/platform';
import { apiClient } from '@/api/client';
import { isServerLocked, getPresetServerUrl } from '@/config/settings';

interface AuthState {
  servers: ServerConfig[];
  currentServerId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  serverLock: boolean;
  presetServerUrl: string | null;

  loadServers: () => Promise<void>;
  addServer: (server: { name: string; url: string; username: string; password: string }) => Promise<boolean>;
  removeServer: (id: string) => Promise<void>;
  login: (serverId: string) => Promise<boolean>;
  loginWithCredentials: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  setCurrentServer: (id: string) => void;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

let platformInstance: ReturnType<typeof usePlatform> | null = null;

const getPlatform = () => {
  if (!platformInstance) {
    throw new Error('Platform not initialized');
  }
  return platformInstance;
};

export const initializeAuthStore = (platform: ReturnType<typeof usePlatform>) => {
  platformInstance = platform;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  servers: [],
  currentServerId: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  serverLock: isServerLocked(),
  presetServerUrl: getPresetServerUrl(),

  loadServers: async () => {
    const platform = getPlatform();
    const servers = await platform.getServers();
    const lastServerId = await platform.getLastServerId();
    set({ servers, currentServerId: lastServerId });

    if (lastServerId) {
      const server = servers.find(s => s.id === lastServerId);
      if (server) {
        apiClient.setCredentials({
          username: server.username,
          token: server.token,
          salt: server.salt,
          serverUrl: server.url,
        });
        set({ isAuthenticated: true });
      }
    }
  },

  addServer: async (serverData) => {
    set({ isLoading: true, error: null });

    const result = await apiClient.ping(serverData.url, serverData.username, serverData.password);
    if (!result.success) {
      set({ isLoading: false, error: result.error || 'Failed to connect to server' });
      return false;
    }

    const salt = Math.random().toString(36).substring(2, 15);
    const token = md5(serverData.password + salt);

    const server: ServerConfig = {
      id: generateId(),
      name: serverData.name,
      url: serverData.url === '/' ? '/' : serverData.url.replace(/\/$/, ''),
      username: serverData.username,
      token,
      salt,
    };

    const servers = [...get().servers, server];
    const platform = getPlatform();
    await platform.saveServers(servers);
    await platform.setLastServerId(server.id);

    apiClient.setCredentials({
      username: server.username,
      token: server.token,
      salt: server.salt,
      serverUrl: server.url,
    });

    set({ servers, currentServerId: server.id, isAuthenticated: true, isLoading: false });
    return true;
  },

  removeServer: async (id) => {
    const servers = get().servers.filter(s => s.id !== id);
    const platform = getPlatform();
    await platform.saveServers(servers);

    if (get().currentServerId === id) {
      const nextServer = servers[0];
      if (nextServer) {
        await platform.setLastServerId(nextServer.id);
        apiClient.setCredentials({
          username: nextServer.username,
          token: nextServer.token,
          salt: nextServer.salt,
          serverUrl: nextServer.url,
        });
        set({ servers, currentServerId: nextServer.id });
      } else {
        await platform.setLastServerId('');
        apiClient.clearCredentials();
        set({ servers, currentServerId: null, isAuthenticated: false });
      }
    } else {
      set({ servers });
    }
  },

  login: async (serverId) => {
    const server = get().servers.find(s => s.id === serverId);
    if (!server) return false;

    apiClient.setCredentials({
      username: server.username,
      token: server.token,
      salt: server.salt,
      serverUrl: server.url,
    });

    const platform = getPlatform();
    await platform.setLastServerId(serverId);
    set({ currentServerId: serverId, isAuthenticated: true });
    return true;
  },

  logout: () => {
    apiClient.clearCredentials();
    set({ isAuthenticated: false });
  },

  loginWithCredentials: async (username: string, password: string) => {
    set({ isLoading: true, error: null });
    const serverUrl = get().presetServerUrl || '/';

    const result = await apiClient.ping(serverUrl, username, password);
    if (!result.success) {
      set({ isLoading: false, error: result.error || 'Failed to connect to server' });
      return false;
    }

    const salt = Math.random().toString(36).substring(2, 15);
    const token = md5(password + salt);

    const server: ServerConfig = {
      id: '__preset__',
      name: 'Server',
      url: serverUrl,
      username,
      token,
      salt,
    };

    apiClient.setCredentials({
      username: server.username,
      token: server.token,
      salt: server.salt,
      serverUrl: server.url,
    });

    const platform = getPlatform();
    await platform.saveServers([server]);
    await platform.setLastServerId(server.id);

    set({ servers: [server], currentServerId: server.id, isAuthenticated: true, isLoading: false });
    return true;
  },

  setCurrentServer: (id) => {
    set({ currentServerId: id });
  },
}));
