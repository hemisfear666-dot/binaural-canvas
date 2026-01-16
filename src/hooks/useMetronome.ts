import { useEffect, useRef } from "react";
import { resumeAudioContext } from "@/lib/audio/resumeAudioContext";

export function useMetronome(
  bpm: number,
  enabled: boolean,
  ensureCtx: () => AudioContext
) {
  const schedulerRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const nextTickTimeRef = useRef(0);

  useEffect(() => {
    const stopScheduler = () => {
      if (schedulerRef.current) {
        clearInterval(schedulerRef.current);
        schedulerRef.current = null;
      }
    };

    if (!enabled) {
      stopScheduler();
      return;
    }

    const clampedBpm = Math.max(20, Math.min(300, bpm));
    const secondsPerBeat = 60 / clampedBpm;

    const ctx = ensureCtx();
    ctxRef.current = ctx;
    void resumeAudioContext(ctx, "metronome");

    const scheduleClick = (time: number) => {
      // schedule a very short click exactly on the audio timeline
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(1200, time);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(0.18, time + 0.001);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(time);
      osc.stop(time + 0.06);
    };

    // Reset next tick on (re)start or BPM changes to avoid drift/jitter
    nextTickTimeRef.current = ctx.currentTime + 0.05;

    const lookAheadSec = 0.12;
    const intervalMs = 25;

    const scheduler = () => {
      const now = ctx.currentTime;
      while (nextTickTimeRef.current < now + lookAheadSec) {
        scheduleClick(nextTickTimeRef.current);
        nextTickTimeRef.current += secondsPerBeat;
      }
    };

    // run immediately, then keep scheduling ahead
    scheduler();
    schedulerRef.current = window.setInterval(scheduler, intervalMs);

    return () => {
      stopScheduler();
    };
  }, [bpm, enabled, ensureCtx]);

  return null;
}
