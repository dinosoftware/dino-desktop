interface DinoSettings {
  serverLock: boolean;
  serverUrl: string | null;
  username?: string | null;
  password?: string | null;
}

declare global {
  interface Window {
    __DINO_SETTINGS__?: Partial<DinoSettings>;
  }
}

export function getDinoSettings(): DinoSettings {
  const s = window.__DINO_SETTINGS__ || {};
  return {
    serverLock: s.serverLock ?? false,
    serverUrl: s.serverUrl ?? null,
    username: s.username ?? null,
    password: s.password ?? null,
  };
}

export function isServerLocked(): boolean {
  return getDinoSettings().serverLock;
}

export function getPresetServerUrl(): string | null {
  return getDinoSettings().serverUrl;
}
