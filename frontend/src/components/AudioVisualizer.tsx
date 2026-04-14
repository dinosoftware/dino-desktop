import { useRef, useEffect } from 'react';

interface AudioVisualizerProps {
  audioElement: HTMLAudioElement | null;
  isPlaying: boolean;
  className?: string;
  barCount?: number;
  barWidth?: number;
  barGap?: number;
  minHeight?: number;
  maxHeight?: number;
  color?: string;
  opacity?: number;
  mirror?: boolean;
}

const wired = new WeakSet<HTMLAudioElement>();
const analyserFor = new WeakMap<HTMLAudioElement, AnalyserNode>();
const gainFor = new WeakMap<HTMLAudioElement, GainNode>();

export function AudioVisualizer({
  audioElement,
  isPlaying,
  className,
  barCount = 48,
  barWidth = 3,
  barGap = 2,
  minHeight = 2,
  maxHeight = 32,
  color,
  opacity = 0.6,
  mirror = false,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const barsRef = useRef<Float32Array>(new Float32Array(barCount).fill(minHeight));

  useEffect(() => {
    if (!audioElement) return;

    const onPlay = () => {
      if (wired.has(audioElement)) {
        const a = analyserFor.get(audioElement);
        if (a && (a.context as AudioContext).state === 'suspended') {
          (a.context as AudioContext).resume();
        }
        return;
      }
      wired.add(audioElement);
      try {
        const ctx = new AudioContext();
        const source = ctx.createMediaElementSource(audioElement);
        const gain = ctx.createGain();
        gain.gain.value = audioElement.volume;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.6;
        source.connect(gain);
        gain.connect(analyser);
        analyser.connect(ctx.destination);
        analyserFor.set(audioElement, analyser);
        gainFor.set(audioElement, gain);

        const syncVolume = () => { gain.gain.value = audioElement.volume; };
        audioElement.addEventListener('volumechange', syncVolume);
      } catch {}
    };

    audioElement.addEventListener('play', onPlay);
    return () => audioElement.removeEventListener('play', onPlay);
  }, [audioElement]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (barsRef.current.length !== barCount) {
      barsRef.current = new Float32Array(barCount).fill(minHeight);
    }
    const bars = barsRef.current;
    const dpr = window.devicePixelRatio || 1;

    const totalWidth = barCount * (barWidth + barGap) - barGap;
    const totalHeight = mirror ? maxHeight * 2 + 2 : maxHeight;
    canvas.width = totalWidth * dpr;
    canvas.height = totalHeight * dpr;
    canvas.style.width = `${totalWidth}px`;
    canvas.style.height = `${totalHeight}px`;

    const c = canvas.getContext('2d');
    if (!c) return;
    c.scale(dpr, dpr);

    const isDark = document.documentElement.classList.contains('dark');
    const barColor = color || (isDark ? 'rgba(255,255,255,' : 'rgba(0,0,0,');

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      c.clearRect(0, 0, totalWidth, totalHeight);

      const analyser = audioElement ? analyserFor.get(audioElement) : null;

      if (analyser && isPlaying) {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const step = Math.max(1, Math.floor(analyser.frequencyBinCount / barCount));
        for (let i = 0; i < barCount; i++) {
          const val = data[i * step] / 255;
          const boosted = Math.pow(val, 0.7);
          const target = minHeight + boosted * (maxHeight - minHeight);
          bars[i] += (target - bars[i]) * 0.4;
        }
      } else {
        for (let i = 0; i < barCount; i++) {
          bars[i] += (minHeight - bars[i]) * 0.12;
        }
      }

      for (let i = 0; i < barCount; i++) {
        bars[i] = Math.max(minHeight, Math.min(maxHeight, bars[i]));
        const barH = bars[i];
        const x = i * (barWidth + barGap);

        if (mirror) {
          const halfH = barH / 2;
          const cy = totalHeight / 2;
          c.fillStyle = `${barColor}${opacity})`;
          c.beginPath();
          c.roundRect(x, cy - halfH, barWidth, halfH, barWidth / 2);
          c.fill();
          c.fillStyle = `${barColor}${opacity * 0.5})`;
          c.beginPath();
          c.roundRect(x, cy, barWidth, halfH, barWidth / 2);
          c.fill();
        } else {
          c.fillStyle = `${barColor}${opacity})`;
          c.beginPath();
          c.roundRect(x, totalHeight - barH, barWidth, barH, barWidth / 2);
          c.fill();
        }
      }
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [barCount, barWidth, barGap, minHeight, maxHeight, color, opacity, mirror, isPlaying, audioElement]);

  return <canvas ref={canvasRef} className={className} />;
}
