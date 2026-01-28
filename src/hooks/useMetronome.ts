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

  const startTimeRef = useRef(0);
  const beatIndexRef = useRef(0);
  const secondsPerBeatRef = useRef(60 / clampBpm(bpm));

  useEffect(() => {
    ensureCtxRef.current = ensureCtx;
  }, [ensureCtx]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // Effect 1: Update BPM ref without restarting scheduler
  useEffect(() => {
    secondsPerBeatRef.current = 60 / clampBpm(bpm);
  }, [bpm]);

  const scheduleClick = (audioCtx: AudioContext, time: number) => {
    if (time <= audioCtx.currentTime - 0.01) return;

    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 880;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.3, time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(time);
    osc.stop(time + 0.04);

    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        // noop
      }
    };
  };

  // Effect 2: Handle enabled state (start/stop scheduler) - ONLY enabled dependency
  useEffect(() => {
    // Clear existing scheduler
    if (schedulerRef.current) {
      clearInterval(schedulerRef.current);
      schedulerRef.current = null;
    }

    if (!enabled) {
      return;
    }

    const ctx = ensureCtxRef.current();
    ctxRef.current = ctx;
    const token = ++initTokenRef.current;

    const lookAheadSec = 2.0;
    const intervalMs = 50;

    const scheduler = () => {
      const audioCtx = ctxRef.current;
      if (!audioCtx || !enabledRef.current) return;

      if (audioCtx.state !== "running") {
        void resumeAudioContext(audioCtx, "metronome");
        return;
      }

      const now = audioCtx.currentTime;
      const spb = secondsPerBeatRef.current;
      const startTime = startTimeRef.current;

      if (!startTime || spb <= 0) return;

      const idealIndex = Math.ceil((now - startTime + 0.01) / spb);
      if (idealIndex > beatIndexRef.current) {
        beatIndexRef.current = idealIndex;
      }

      let i = beatIndexRef.current;
      let nextTime = startTime + i * spb;

      let scheduled = 0;
      while (nextTime < now + lookAheadSec && scheduled < 256) {
        scheduleClick(audioCtx, nextTime);
        i += 1;
        nextTime = startTime + i * spb;
        scheduled += 1;
      }

      beatIndexRef.current = i;
    };

    (async () => {
      const ok = await resumeAudioContext(ctx, "metronome");
      if (!ok) {
        console.warn("[metronome] AudioContext not running");
        return;
      }
      if (initTokenRef.current !== token) {
        return;
      }

      startTimeRef.current = ctx.currentTime + 0.05;
      beatIndexRef.current = 0;

      scheduler();
      schedulerRef.current = window.setInterval(scheduler, intervalMs);
    })();

    return () => {
      initTokenRef.current += 1;
      if (schedulerRef.current) {
        clearInterval(schedulerRef.current);
        schedulerRef.current = null;
      }
    };
  }, [enabled]); // ONLY enabled dependency - BPM changes update ref without restarting

  return null;
}
