import { useCallback, useEffect, useRef } from "react";
import { AmbientMusicType } from "@/types/binaural";
import { resumeAudioContext } from "@/lib/audio/resumeAudioContext";
import { getTrackConfig, isTrackConfigured } from "@/lib/audio/ambience/ambientMusicTracks";

/**
 * AMBIENT MUSIC PLAYER
 * ====================
 * 
 * Plays audio files configured in:
 * src/lib/audio/ambience/ambientMusicTracks.ts
 * 
 * NO AUDIO WILL PLAY until you configure URLs in that file!
 */

interface RunningAmbient {
  type: AmbientMusicType;
  audio: HTMLAudioElement;
  gainNode: GainNode;
  sourceNode: MediaElementAudioSourceNode;
  stop: () => void;
}

async function createAmbientFromFile(
  ctx: AudioContext, 
  type: AmbientMusicType, 
  dest: AudioNode
): Promise<RunningAmbient | null> {
  const config = getTrackConfig(type);
  
  if (!config) {
    console.warn(`[Ambience] No track configured for "${type}". Edit src/lib/audio/ambience/ambientMusicTracks.ts`);
    return null;
  }

  const audio = new Audio(config.url);
  audio.loop = true;
  audio.crossOrigin = "anonymous";

  // Create Web Audio nodes for routing through the mixer
  const sourceNode = ctx.createMediaElementSource(audio);
  const gainNode = ctx.createGain();
  gainNode.gain.value = config.volume ?? 1;

  sourceNode.connect(gainNode);
  gainNode.connect(dest);

  try {
    await audio.play();
  } catch (err) {
    console.error(`[Ambience] Failed to play "${type}":`, err);
    sourceNode.disconnect();
    gainNode.disconnect();
    return null;
  }

  return {
    type,
    audio,
    gainNode,
    sourceNode,
    stop: () => {
      audio.pause();
      audio.currentTime = 0;
      try { sourceNode.disconnect(); } catch {}
      try { gainNode.disconnect(); } catch {}
    }
  };
}

export function useAmbientMusicPlayer(
  ensureCtx: () => AudioContext,
  getDestination: () => GainNode,
  enabled: boolean,
  type: AmbientMusicType
) {
  const runningRef = useRef<RunningAmbient | null>(null);
  const previewRef = useRef<RunningAmbient | null>(null);
  const ensureCtxRef = useRef(ensureCtx);
  const getDestRef = useRef(getDestination);

  useEffect(() => {
    ensureCtxRef.current = ensureCtx;
    getDestRef.current = getDestination;
  }, [ensureCtx, getDestination]);

  const stopTrack = useCallback((track: RunningAmbient | null) => {
    if (track) track.stop();
  }, []);

  // Main playback
  useEffect(() => {
    if (!enabled) {
      if (runningRef.current) {
        stopTrack(runningRef.current);
        runningRef.current = null;
      }
      return;
    }

    // Check if track is configured
    if (!isTrackConfigured(type)) {
      console.warn(`[Ambience] Track "${type}" not configured. Edit src/lib/audio/ambience/ambientMusicTracks.ts`);
      return;
    }

    const ctx = ensureCtxRef.current();
    void resumeAudioContext(ctx, "ambient-music");
    const dest = getDestRef.current();

    // Stop previous if type changed
    if (runningRef.current && runningRef.current.type !== type) {
      stopTrack(runningRef.current);
      runningRef.current = null;
    }

    if (!runningRef.current) {
      void createAmbientFromFile(ctx, type, dest).then(ambient => {
        if (ambient) runningRef.current = ambient;
      });
    }

    return () => {
      if (runningRef.current) {
        stopTrack(runningRef.current);
        runningRef.current = null;
      }
    };
  }, [enabled, type, stopTrack]);

  const startPreview = useCallback(async (previewType: AmbientMusicType) => {
    if (previewRef.current) {
      stopTrack(previewRef.current);
      previewRef.current = null;
    }

    if (!isTrackConfigured(previewType)) {
      console.warn(`[Ambience] Track "${previewType}" not configured for preview.`);
      return;
    }

    const ctx = ensureCtxRef.current();
    await resumeAudioContext(ctx, "ambient-music-preview");
    const dest = getDestRef.current();

    const ambient = await createAmbientFromFile(ctx, previewType, dest);
    if (ambient) previewRef.current = ambient;
  }, [stopTrack]);

  const stopPreview = useCallback(() => {
    if (previewRef.current) {
      stopTrack(previewRef.current);
      previewRef.current = null;
    }
  }, [stopTrack]);

  return { startPreview, stopPreview };
}
