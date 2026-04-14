import { Disc3 } from 'lucide-react';

export function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 animate-fade-in">
      <div className="relative">
        <Disc3 className="h-10 w-10 text-primary animate-spin" style={{ animationDuration: '2s' }} />
      </div>
    </div>
  );
}

export function LoadingSpinner({ className = '' }: { className?: string }) {
  return (
    <div className={`h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin ${className}`} />
  );
}

export function AlbumGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-fade-in" style={{ animationDelay: `${i * 40}ms` }}>
          <div className="space-y-2.5">
            <div className="aspect-square rounded-lg bg-muted/70 animate-pulse" />
            <div className="space-y-1.5 px-1">
              <div className="h-3.5 bg-muted/70 animate-pulse rounded w-4/5" />
              <div className="h-3 bg-muted/50 animate-pulse rounded w-3/5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TrackListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
          <div className="h-10 w-10 rounded bg-muted/70 animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-1.5 min-w-0">
            <div className="h-3.5 bg-muted/70 animate-pulse rounded w-2/5" />
            <div className="h-3 bg-muted/50 animate-pulse rounded w-1/4" />
          </div>
          <div className="h-3 bg-muted/50 animate-pulse rounded w-10 flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}
