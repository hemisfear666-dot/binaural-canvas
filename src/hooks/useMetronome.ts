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
  // Initialize with actual BPM value
  const secondsPerBeatRef = useRef(60 / Math.max(20, Math.min(300, bpm)));
  const ensureCtxRef = useRef(ensureCtx);
  const enabledRef = useRef(enabled);

  // Keep refs up to date
  useEffect(() => {
    ensureCtxRef.current = ensureCtx;
  }, [ensureCtx]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // Update seconds per beat when BPM changes
  useEffect(() => {
    const clampedBpm = Math.max(20, Math.min(300, bpm));
    secondsPerBeatRef.current = 60 / clampedBpm;
  }, [bpm]);

  useEffect(() => {
    // Clear any existing scheduler first
    if (schedulerRef.current) {
      clearInterval(schedulerRef.current);
      schedulerRef.current = null;
    }

    if (!enabled) {
      return;
    }

    const ctx = ensureCtxRef.current();
    ctxRef.current = ctx;
    void resumeAudioContext(ctx, "metronome");

    // Reset next tick time when starting
    nextTickTimeRef.current = ctx.currentTime + 0.05;

    const scheduleClick = (time: number) => {
      const audioCtx = ctxRef.current;
      if (!audioCtx) return;

      // Create a short "tick" sound
      const osc = audioCtx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 880; // A5

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.3, time + 0.001);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(time);
      osc.stop(time + 0.04);
    };

    const lookAheadSec = 0.1;
    const intervalMs = 25;

    const scheduler = () => {
      const audioCtx = ctxRef.current;
      if (!audioCtx || !enabledRef.current) return;

      const now = audioCtx.currentTime;
      const spb = secondsPerBeatRef.current;

      // If we've fallen behind (tab was backgrounded), skip ahead
      if (nextTickTimeRef.current < now) {
        nextTickTimeRef.current = now + 0.01;
      }

      // Schedule clicks in the lookahead window
      while (nextTickTimeRef.current < now + lookAheadSec) {
        scheduleClick(nextTickTimeRef.current);
        nextTickTimeRef.current += spb;
      }
    };

    // Start scheduling
    scheduler();
    schedulerRef.current = window.setInterval(scheduler, intervalMs);

    return () => {
      if (schedulerRef.current) {
        clearInterval(schedulerRef.current);
        schedulerRef.current = null;
      }
    };
  }, [enabled]);

  return null;
}
