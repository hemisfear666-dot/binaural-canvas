import { useCallback, useEffect, useRef } from "react";
import { AmbientMusicType } from "@/types/binaural";
import { resumeAudioContext } from "@/lib/audio/resumeAudioContext";

// Bundled CC0/public-domain tracks (stored in /public/audio)
// NOTE: we decode and play via WebAudio to avoid HTMLAudioElement autoplay/CORS issues.
const AMBIENT_TRACKS: Record<AmbientMusicType, string> = {
  soothing: "/audio/soothing.wav",
  focus: "/audio/focus.wav",
  sleep: "/audio/sleep.wav",
};

type RunningAmbientTrack = {
  type: AmbientMusicType;
  source: AudioBufferSourceNode;
  gainNode: GainNode;
  stop: () => void;
};

export function useAmbientMusicPlayer(
  ensureCtx: () => AudioContext,
  getDestination: () => GainNode,
  enabled: boolean,
  type: AmbientMusicType
) {
  const runningRef = useRef<RunningAmbientTrack | null>(null);
  const previewRef = useRef<RunningAmbientTrack | null>(null);

  // Cache decoded audio per AudioContext
  const bufferCacheRef = useRef<WeakMap<AudioContext, Map<string, AudioBuffer>>>(new WeakMap());

  const getBuffer = useCallback(async (ctx: AudioContext, url: string) => {
    const byCtx = bufferCacheRef.current;
    let map = byCtx.get(ctx);
    if (!map) {
      map = new Map();
      byCtx.set(ctx, map);
    }

    const cached = map.get(url);
    if (cached) return cached;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Ambient track fetch failed (${res.status}) for ${url}`);

    const arr = await res.arrayBuffer();
    const buf = await ctx.decodeAudioData(arr.slice(0));
    map.set(url, buf);
    return buf;
  }, []);

  const stopTrack = useCallback((track: RunningAmbientTrack | null) => {
    if (!track) return;
    try {
      track.stop();
    } catch {
      // ignore
    }
  }, []);

  const startTrack = useCallback(
    async (ctx: AudioContext, dest: GainNode, trackType: AmbientMusicType) => {
      const url = AMBIENT_TRACKS[trackType];
      const buffer = await getBuffer(ctx, url);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const gainNode = ctx.createGain();
      gainNode.gain.value = 1;

      source.connect(gainNode);
      gainNode.connect(dest);

      source.start();

      const stop = () => {
        try {
          source.stop();
        } catch {
          // ignore
        }
        try {
          source.disconnect();
          gainNode.disconnect();
        } catch {
          // ignore
        }
      };

      return { type: trackType, source, gainNode, stop } satisfies RunningAmbientTrack;
    },
    [getBuffer]
  );

  // Main playback (when enabled and transport is playing)
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!enabled) {
        if (runningRef.current) {
          stopTrack(runningRef.current);
          runningRef.current = null;
        }
        return;
      }

      const ctx = ensureCtx();
      void resumeAudioContext(ctx, "ambient-music");
      const dest = getDestination();

      // Stop previous if type changed
      if (runningRef.current && runningRef.current.type !== type) {
        stopTrack(runningRef.current);
        runningRef.current = null;
      }

      if (!runningRef.current) {
        try {
          const track = await startTrack(ctx, dest, type);
          if (cancelled) {
            stopTrack(track);
            return;
          }
          runningRef.current = track;
        } catch (e) {
          console.warn("Ambient music failed to start:", e);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (runningRef.current) {
        stopTrack(runningRef.current);
        runningRef.current = null;
      }
    };
  }, [enabled, type, ensureCtx, getDestination, startTrack, stopTrack]);

  const startPreview = useCallback(
    async (previewType: AmbientMusicType) => {
      // Stop any existing preview
      if (previewRef.current) {
        stopTrack(previewRef.current);
        previewRef.current = null;
      }

      const ctx = ensureCtx();
      await resumeAudioContext(ctx, "ambient-music-preview");
      const dest = getDestination();

      try {
        previewRef.current = await startTrack(ctx, dest, previewType);
      } catch (e) {
        console.warn("Failed to start ambient music preview:", e);
      }
    },
    [ensureCtx, getDestination, startTrack, stopTrack]
  );

  const stopPreview = useCallback(() => {
    if (previewRef.current) {
      stopTrack(previewRef.current);
      previewRef.current = null;
    }
  }, [stopTrack]);

  return { startPreview, stopPreview };
}
