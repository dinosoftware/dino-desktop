import { createContext, useContext, useState, useEffect } from 'react';
import { Disc3 } from 'lucide-react';
import type { PlatformAPI } from './types';
import { webPlatform } from './web';

const PlatformContext = createContext<PlatformAPI>(webPlatform);

export function usePlatform(): PlatformAPI {
  return useContext(PlatformContext);
}

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const [platform, setPlatform] = useState<PlatformAPI>(webPlatform);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const tryLoadWails = async () => {
      try {
        if (window.go?.main?.App) {
          const { WailsPlatform } = await import('./wails');
          setPlatform(new WailsPlatform());
        }
      } catch {
        // not in wails, use web
      }
      setReady(true);
    };
    tryLoadWails();
  }, []);

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Disc3 className="h-8 w-8 text-primary animate-spin" style={{ animationDuration: '2s' }} />
      </div>
    );
  }

  return (
    <PlatformContext.Provider value={platform}>
      {children}
    </PlatformContext.Provider>
  );
}

export { webPlatform };
