import { useRef, useCallback, useEffect } from 'react';
import { AmbienceType } from '@/types/binaural';

type EnsureAudioContext = () => AudioContext;

type GetDestination = () => AudioNode;

// NOTE: user reported rain/drone swapped; these are now corrected.
const AMBIENCE_URLS: Record<AmbienceType, string | null> = {
  none: null,
  rain: 'https://assets.mixkit.co/active_storage/sfx/123/123-preview.mp3',
  forest: 'https://assets.mixkit.co/active_storage/sfx/1210/1210-preview.mp3',
  drone: 'https://assets.mixkit.co/active_storage/sfx/212/212-preview.mp3',
};

export function useAmbiencePlayer(
  ensureAudioContext: EnsureAudioContext,
  getDestination: GetDestination,
  enabled: boolean,
  ambienceType: AmbienceType
) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const currentTypeRef = useRef<AmbienceType>('none');
  const connectedRef = useRef(false);

  const stopPreview = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  const startPreview = useCallback(
    (type?: AmbienceType) => {
      const typeToPlay = type ?? ambienceType;
      if (typeToPlay === 'none') return;

      const url = AMBIENCE_URLS[typeToPlay];
      if (!url) return;

      const ctx = ensureAudioContext();
      const dest = getDestination();

      // Build/replace element if type changed
      if (!audioRef.current || currentTypeRef.current !== typeToPlay) {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = '';
        }
        if (sourceRef.current) {
          try {
            sourceRef.current.disconnect();
          } catch {
            // ignore
          }
          sourceRef.current = null;
          connectedRef.current = false;
        }

        const el = new Audio();
        el.crossOrigin = 'anonymous';
        el.loop = true;
        el.preload = 'auto';
        el.src = url;
        audioRef.current = el;
        currentTypeRef.current = typeToPlay;
      }

      if (!connectedRef.current && audioRef.current) {
        try {
          sourceRef.current = ctx.createMediaElementSource(audioRef.current);
          sourceRef.current.connect(dest);
          connectedRef.current = true;
        } catch {
          // If already connected, ignore.
          connectedRef.current = true;
        }
      }

      audioRef.current
        ?.play()
        .catch((e) => console.log('Ambience autoplay blocked:', e));
    },
    [ambienceType, ensureAudioContext, getDestination]
  );

  useEffect(() => {
    if (enabled && ambienceType !== 'none') startPreview(ambienceType);
    else stopPreview();
  }, [ambienceType, enabled, startPreview, stopPreview]);

  useEffect(() => {
    return () => {
      stopPreview();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch {
          // ignore
        }
      }
    };
  }, [stopPreview]);

  return { startPreview, stopPreview };
}
