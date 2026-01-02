import { useRef, useCallback, useEffect } from 'react';
import { AmbienceType } from '@/types/binaural';

// Placeholder URLs - these would be replaced with actual audio files
const AMBIENCE_URLS: Record<AmbienceType, string | null> = {
  none: null,
  rain: 'https://cdn.freesound.org/previews/531/531947_2293324-lq.mp3',
  forest: 'https://cdn.freesound.org/previews/514/514906_11405048-lq.mp3', 
  drone: 'https://cdn.freesound.org/previews/560/560393_5674468-lq.mp3',
};

export function useAmbiencePlayer(enabled: boolean, ambienceType: AmbienceType, volume: number) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  const start = useCallback(() => {
    if (ambienceType === 'none') return;
    
    const url = AMBIENCE_URLS[ambienceType];
    if (!url) return;

    // Create audio element if needed
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = 'anonymous';
      audioRef.current.loop = true;
    }

    // Set up audio context for volume control
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // Connect audio element to gain node
    if (!sourceRef.current && audioRef.current) {
      sourceRef.current = ctx.createMediaElementSource(audioRef.current);
      gainNodeRef.current = ctx.createGain();
      sourceRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(ctx.destination);
    }

    if (gainNodeRef.current) {
      gainNodeRef.current.gain.setValueAtTime(volume, ctx.currentTime);
    }

    audioRef.current.src = url;
    audioRef.current.play().catch(() => {
      // Autoplay may be blocked
    });
  }, [ambienceType, volume]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  // Update volume
  useEffect(() => {
    if (gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current.gain.setValueAtTime(volume, audioCtxRef.current.currentTime);
    }
  }, [volume]);

  // Handle enabled state and type changes
  useEffect(() => {
    if (enabled && ambienceType !== 'none') {
      // Need to recreate for type change
      if (audioRef.current && audioRef.current.src !== AMBIENCE_URLS[ambienceType]) {
        stop();
        // Small delay to ensure proper cleanup
        setTimeout(start, 50);
      } else if (!audioRef.current?.src) {
        start();
      }
    } else {
      stop();
    }
  }, [enabled, ambienceType, start, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, [stop]);

  return { start, stop };
}
