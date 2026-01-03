import { useRef, useCallback, useEffect } from 'react';
import { AmbienceType } from '@/types/binaural';

// Working audio URLs from reliable sources
const AMBIENCE_URLS: Record<AmbienceType, string | null> = {
  none: null,
  rain: 'https://assets.mixkit.co/active_storage/sfx/212/212-preview.mp3',
  forest: 'https://assets.mixkit.co/active_storage/sfx/1210/1210-preview.mp3',
  drone: 'https://assets.mixkit.co/active_storage/sfx/123/123-preview.mp3',
};

export function useAmbiencePlayer(
  enabled: boolean,
  ambienceType: AmbienceType,
  volume: number
) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const currentTypeRef = useRef<AmbienceType>('none');
  const isConnectedRef = useRef(false);

  const setupAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    if (!gainNodeRef.current) {
      gainNodeRef.current = audioCtxRef.current.createGain();
      gainNodeRef.current.connect(audioCtxRef.current.destination);
    }
    
    return audioCtxRef.current;
  }, []);

  const startPreview = useCallback((type?: AmbienceType) => {
    const typeToPlay = type ?? ambienceType;
    if (typeToPlay === 'none') return;
    
    const url = AMBIENCE_URLS[typeToPlay];
    if (!url) return;

    const ctx = setupAudio();
    
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // Create new audio element if needed or if type changed
    if (!audioRef.current || currentTypeRef.current !== typeToPlay) {
      // Cleanup old audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch (e) {}
        sourceRef.current = null;
        isConnectedRef.current = false;
      }

      audioRef.current = new Audio();
      audioRef.current.crossOrigin = 'anonymous';
      audioRef.current.loop = true;
      audioRef.current.src = url;
      currentTypeRef.current = typeToPlay;
    }

    // Connect to Web Audio API if not connected
    if (!isConnectedRef.current && audioRef.current && gainNodeRef.current) {
      try {
        sourceRef.current = ctx.createMediaElementSource(audioRef.current);
        sourceRef.current.connect(gainNodeRef.current);
        isConnectedRef.current = true;
      } catch (e) {
        // Already connected
        isConnectedRef.current = true;
      }
    }

    if (gainNodeRef.current) {
      gainNodeRef.current.gain.setValueAtTime(volume, ctx.currentTime);
    }

    audioRef.current?.play().catch((e) => {
      console.log('Ambience autoplay blocked:', e);
    });
  }, [ambienceType, volume, setupAudio]);

  const stopPreview = useCallback(() => {
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
      // Restart if type changed
      if (currentTypeRef.current !== ambienceType) {
        stopPreview();
        setTimeout(() => startPreview(), 100);
      } else {
        startPreview();
      }
    } else {
      stopPreview();
    }
  }, [enabled, ambienceType, startPreview, stopPreview]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch (e) {}
      }
      if (gainNodeRef.current) {
        try {
          gainNodeRef.current.disconnect();
        } catch (e) {}
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, []);

  return { startPreview, stopPreview };
}
