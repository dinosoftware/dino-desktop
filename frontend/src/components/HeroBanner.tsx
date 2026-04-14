import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/api/client';
import { usePlayerStore } from '@/stores';
import type { Track, GetRandomSongsResponse } from '@/api/types';
import { Play, Shuffle, Disc } from 'lucide-react';
import { cn } from '@/lib/utils';

const AUTO_SCROLL_INTERVAL = 5000;

export function HeroBanner() {
  const navigate = useNavigate();
  const { playQueue } = usePlayerStore();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadRandomSongs();
  }, []);

  useEffect(() => {
    if (tracks.length <= 1) return;

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % tracks.length);
    }, AUTO_SCROLL_INTERVAL);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [tracks.length]);

  const loadRandomSongs = async () => {
    try {
      const data = await apiClient.request<GetRandomSongsResponse>('getRandomSongs', {
        size: 10,
      });
      setTracks(data.randomSongs?.song || []);
    } catch (err) {
      console.error('Failed to load random songs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = (track: Track) => {
    playQueue([track], 0);
  };

  const handleShuffle = (track: Track) => {
    const otherTracks = tracks.filter((t) => t.id !== track.id);
    const shuffled = [...otherTracks].sort(() => Math.random() - 0.5);
    playQueue([track, ...shuffled], 0);
  };

  if (loading) {
    return (
      <div className="h-52 rounded-2xl bg-muted animate-pulse mb-8" />
    );
  }

  if (tracks.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <div className="relative overflow-hidden rounded-2xl">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {tracks.map((track) => (
            <HeroCard
              key={track.id}
              track={track}
              onPlay={() => handlePlay(track)}
              onShuffle={() => handleShuffle(track)}
              onNavigate={() => track.albumId && navigate(`/album/${track.albumId}`)}
            />
          ))}
        </div>
      </div>

      {tracks.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-4">
          {tracks.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                index === currentIndex
                  ? 'w-5 bg-primary'
                  : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50'
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface HeroCardProps {
  track: Track;
  onPlay: () => void;
  onShuffle: () => void;
  onNavigate: () => void;
}

function HeroCard({ track, onPlay, onShuffle, onNavigate }: HeroCardProps) {
  const coverUrl = track.coverArt ? apiClient.buildCoverArtUrl(track.coverArt, 600) : null;

  return (
    <div className="w-full flex-shrink-0 h-52 relative group cursor-pointer" onClick={onNavigate}>
      <div className="absolute inset-0 rounded-2xl overflow-hidden">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={track.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Disc className="h-16 w-16 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      </div>

      <div className="absolute inset-x-0 bottom-0 p-5 flex items-end justify-between">
        <div className="min-w-0 flex-1 mr-4">
          <h3 className="text-lg font-bold text-white truncate drop-shadow-lg">
            {track.title}
          </h3>
          <p className="text-sm text-white/80 truncate">{track.artist}</p>
          {track.album && (
            <p className="text-xs text-white/60 truncate">{track.album}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
            className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform"
          >
            <Play className="h-5 w-5 ml-0.5" fill="currentColor" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShuffle();
            }}
            className="h-12 w-12 rounded-full bg-white/10 backdrop-blur-sm text-white border border-white/20 flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all"
          >
            <Shuffle className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
