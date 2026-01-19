import { useCallback, useRef, useEffect } from 'react';
import { AmbientMusicType } from '@/types/binaural';
import { resumeAudioContext } from '@/lib/audio/resumeAudioContext';

// CC0 Ambient music tracks from freesound.org / Pixabay
const AMBIENT_TRACKS: Record<AmbientMusicType, string> = {
  soothing: 'https://cdn.pixabay.com/audio/2024/11/29/audio_cb4cb98c51.mp3', // Calm ambient pad
  focus: 'https://cdn.pixabay.com/audio/2024/09/03/audio_e53b0ff5d8.mp3', // Focus concentration music
  sleep: 'https://cdn.pixabay.com/audio/2024/02/14/audio_32ebe0f3b7.mp3', // Deep sleep ambient
};

interface RunningAmbientTrack {
  type: AmbientMusicType;
  audio: HTMLAudioElement;
  source: MediaElementAudioSourceNode;
  gainNode: GainNode;
}

export function useAmbientMusicPlayer(
  ensureCtx: () => AudioContext,
  getDestination: () => GainNode,
  enabled: boolean,
  type: AmbientMusicType
) {
  const runningRef = useRef<RunningAmbientTrack | null>(null);
  const previewRef = useRef<RunningAmbientTrack | null>(null);
  const connectedAudiosRef = useRef<Set<HTMLAudioElement>>(new Set());

  const createTrack = useCallback((
    ctx: AudioContext, 
    dest: GainNode, 
    trackType: AmbientMusicType
  ): RunningAmbientTrack => {
    const audio = new Audio(AMBIENT_TRACKS[trackType]);
    audio.loop = true;
    audio.crossOrigin = 'anonymous';
    audio.volume = 1; // Volume controlled by gain node

    // Only create MediaElementSource once per audio element
    let source: MediaElementAudioSourceNode;
    if (connectedAudiosRef.current.has(audio)) {
      // This shouldn't happen with new Audio() but safety check
      throw new Error('Audio element already connected');
    }
    
    source = ctx.createMediaElementSource(audio);
    connectedAudiosRef.current.add(audio);
    
    const gainNode = ctx.createGain();
    gainNode.gain.value = 1;
    
    source.connect(gainNode);
    gainNode.connect(dest);
    
    return { type: trackType, audio, source, gainNode };
  }, []);

  const stopTrack = useCallback((track: RunningAmbientTrack | null) => {
    if (!track) return;
    try {
      track.audio.pause();
      track.audio.currentTime = 0;
      track.gainNode.disconnect();
      track.source.disconnect();
      connectedAudiosRef.current.delete(track.audio);
    } catch {
      // ignore
    }
  }, []);

  // Main playback (when enabled and playing)
  useEffect(() => {
    if (!enabled) {
      if (runningRef.current) {
        stopTrack(runningRef.current);
        runningRef.current = null;
      }
      return;
    }

    const ctx = ensureCtx();
    const dest = getDestination();

    // Stop previous if type changed
    if (runningRef.current && runningRef.current.type !== type) {
      stopTrack(runningRef.current);
      runningRef.current = null;
    }

    if (!runningRef.current) {
      try {
        runningRef.current = createTrack(ctx, dest, type);
        runningRef.current.audio.play().catch(console.warn);
      } catch (e) {
        console.warn('Failed to create ambient music track:', e);
      }
    }

    return () => {
      if (runningRef.current) {
        stopTrack(runningRef.current);
        runningRef.current = null;
      }
    };
  }, [enabled, type, ensureCtx, getDestination, createTrack, stopTrack]);

  const startPreview = useCallback(async (previewType: AmbientMusicType) => {
    // Stop any existing preview
    if (previewRef.current) {
      stopTrack(previewRef.current);
      previewRef.current = null;
    }

    const ctx = ensureCtx();
    await resumeAudioContext(ctx, 'ambient-music-preview');
    const dest = getDestination();
    
    try {
      previewRef.current = createTrack(ctx, dest, previewType);
      await previewRef.current.audio.play();
    } catch (e) {
      console.warn('Failed to start ambient music preview:', e);
    }
  }, [ensureCtx, getDestination, createTrack, stopTrack]);

  const stopPreview = useCallback(() => {
    if (previewRef.current) {
      stopTrack(previewRef.current);
      previewRef.current = null;
    }
  }, [stopTrack]);

  return { startPreview, stopPreview };
}
