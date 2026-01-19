import { useEffect, useRef } from "react";
import { resumeAudioContext } from "@/lib/audio/resumeAudioContext";

const clampBpm = (bpm: number) => {
  const n = Number.isFinite(bpm) ? bpm : 120;
  return Math.max(20, Math.min(300, n));
};

export function useMetronome(
  bpm: number,
  enabled: boolean,
  ensureCtx: () => AudioContext
) {
  const schedulerRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  const ensureCtxRef = useRef(ensureCtx);
  const enabledRef = useRef(enabled);

  // Clocking model: startTime + beatIndex * secondsPerBeat
  // This is much more stable than incrementing `nextTickTime` over time.
  const startTimeRef = useRef(0);
  const beatIndexRef = useRef(0);
  const secondsPerBeatRef = useRef(60 / clampBpm(bpm));

  useEffect(() => {
    ensureCtxRef.current = ensureCtx;
  }, [ensureCtx]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    secondsPerBeatRef.current = 60 / clampBpm(bpm);
  }, [bpm]);

  const scheduleClick = (audioCtx: AudioContext, time: number) => {
    // Guard against scheduling too far in the past (can sound like random bursts)
    if (time <= audioCtx.currentTime - 0.01) return;

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

    // Ensure nodes can be GC'd
    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        // noop
      }
    };
  };

  useEffect(() => {
    // Always clear any existing scheduler first
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

    // Re-sync the metronome clock whenever it is enabled OR BPM changes.
    // This prevents "drift" and "catch-up" bursts that can sound random.
    startTimeRef.current = ctx.currentTime + 0.05;
    beatIndexRef.current = 0;

    const lookAheadSec = 0.12;
    const intervalMs = 25;

    const scheduler = () => {
      const audioCtx = ctxRef.current;
      if (!audioCtx || !enabledRef.current) return;

      const now = audioCtx.currentTime;
      const spb = secondsPerBeatRef.current;
      const startTime = startTimeRef.current;

      if (!startTime || spb <= 0) return;

      // If the browser stalls (background throttling / heavy UI), jump the index forward
      // so we DON'T schedule a pile of late clicks.
      const idealIndex = Math.ceil((now - startTime + 0.01) / spb);
      if (idealIndex > beatIndexRef.current) {
        beatIndexRef.current = idealIndex;
      }

      // Schedule within lookahead window
      let i = beatIndexRef.current;
      let nextTime = startTime + i * spb;

      // Hard safety to avoid infinite loops on weird timing
      let scheduled = 0;
      while (nextTime < now + lookAheadSec && scheduled < 64) {
        scheduleClick(audioCtx, nextTime);
        i += 1;
        nextTime = startTime + i * spb;
        scheduled += 1;
      }

      beatIndexRef.current = i;
    };

    scheduler();
    schedulerRef.current = window.setInterval(scheduler, intervalMs);

    return () => {
      if (schedulerRef.current) {
        clearInterval(schedulerRef.current);
        schedulerRef.current = null;
      }
    };
  }, [enabled, bpm]);

  return null;
}
