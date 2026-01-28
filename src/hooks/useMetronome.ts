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
  const initTokenRef = useRef(0);

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

    console.log("[metronome] effect triggered, enabled:", enabled, "bpm:", bpm);

    if (!enabled) {
      console.log("[metronome] disabled, exiting early");
      return;
    }

    const ctx = ensureCtxRef.current();
    ctxRef.current = ctx;
    const token = ++initTokenRef.current;

    console.log("[metronome] context obtained, state:", ctx.state, "currentTime:", ctx.currentTime);

    // IMPORTANT: browsers can occasionally stall the JS thread (heavy UI, GC, tab throttling).
    // If our lookahead window is too small, we can run out of scheduled clicks and it will
    // sound like the metronome “randomly stops” even though state is still playing.
    // Scheduling further ahead makes the metronome resilient to these stalls.
    const lookAheadSec = 2.0;
    const intervalMs = 50;

    const scheduler = () => {
      const audioCtx = ctxRef.current;
      if (!audioCtx || !enabledRef.current) return;

      // If the context got suspended (backgrounding / autoplay policy), avoid
      // scheduling against a frozen clock. We'll keep retrying resume.
      if (audioCtx.state !== "running") {
        void resumeAudioContext(audioCtx, "metronome");
        return;
      }

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
      while (nextTime < now + lookAheadSec && scheduled < 256) {
        scheduleClick(audioCtx, nextTime);
        i += 1;
        nextTime = startTime + i * spb;
        scheduled += 1;
      }

      beatIndexRef.current = i;
    };

    // Wait until the AudioContext is actually running before we lock the clock.
    // This avoids cases where we schedule once against a suspended clock and then
    // never catch up cleanly.
    (async () => {
      console.log("[metronome] async init, attempting resume...");
      const ok = await resumeAudioContext(ctx, "metronome");
      console.log("[metronome] resume result:", ok, "ctx.state:", ctx.state);
      if (!ok) {
        console.warn("[metronome] AudioContext not running; metronome will stay silent until resumed by a user gesture.");
        return;
      }
      // If a newer enable/BPM change happened while awaiting resume, bail.
      if (initTokenRef.current !== token) {
        console.log("[metronome] token mismatch, bailing (newer init happened)");
        return;
      }

      // Re-sync the metronome clock whenever it is enabled OR BPM changes.
      // This prevents "drift" and "catch-up" bursts that can sound random.
      startTimeRef.current = ctx.currentTime + 0.05;
      beatIndexRef.current = 0;

      console.log("[metronome] scheduler starting, startTime:", startTimeRef.current, "spb:", secondsPerBeatRef.current);
      scheduler();
      schedulerRef.current = window.setInterval(scheduler, intervalMs);
    })();

    return () => {
      // Invalidate any pending async init
      initTokenRef.current += 1;
      if (schedulerRef.current) {
        clearInterval(schedulerRef.current);
        schedulerRef.current = null;
      }
    };
  }, [enabled, bpm]);

  return null;
}
