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
  const secondsPerBeatRef = useRef(0.5);

  // Update seconds per beat when BPM changes (without restarting scheduler)
  useEffect(() => {
    const clampedBpm = Math.max(20, Math.min(300, bpm));
    secondsPerBeatRef.current = 60 / clampedBpm;
  }, [bpm]);

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

    const ctx = ensureCtx();
    ctxRef.current = ctx;
    void resumeAudioContext(ctx, "metronome");

    const scheduleClick = (time: number) => {
      // Schedule a precise click on the audio timeline
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, time); // A5 - clear tick sound

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(0.25, time + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(time);
      osc.stop(time + 0.05);
    };

    // Initialize the next tick time relative to current audio time
    nextTickTimeRef.current = ctx.currentTime + 0.1;

    const lookAheadSec = 0.1; // How far ahead to schedule (seconds)
    const intervalMs = 25; // How often to check (milliseconds)

    const scheduler = () => {
      if (!ctxRef.current) return;
      const now = ctxRef.current.currentTime;
      
      // Schedule all clicks that fall within the lookahead window
      while (nextTickTimeRef.current < now + lookAheadSec) {
        scheduleClick(nextTickTimeRef.current);
        nextTickTimeRef.current += secondsPerBeatRef.current;
      }
    };

    // Run scheduler immediately and then at regular intervals
    scheduler();
    schedulerRef.current = window.setInterval(scheduler, intervalMs);

    return () => {
      stopScheduler();
    };
  }, [enabled, ensureCtx]); // Removed bpm from deps - uses ref instead

  return null;
}
