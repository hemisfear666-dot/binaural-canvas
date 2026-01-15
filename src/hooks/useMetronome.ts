import { useRef, useCallback, useEffect } from 'react';
import { resumeAudioContext } from '@/lib/audio/resumeAudioContext';

export function useMetronome(bpm: number, enabled: boolean, ensureCtx: () => AudioContext) {
  const intervalRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  const playClick = useCallback(() => {
    if (!ctxRef.current) return;
    const ctx = ctxRef.current;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1000;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const ctx = ensureCtx();
    ctxRef.current = ctx;
    resumeAudioContext(ctx, 'metronome');

    const ms = 60000 / Math.max(20, Math.min(300, bpm));

    // Play immediately
    playClick();

    intervalRef.current = window.setInterval(playClick, ms);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, bpm, ensureCtx, playClick]);

  return null;
}
