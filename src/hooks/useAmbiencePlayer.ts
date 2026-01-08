import { useRef, useCallback, useEffect } from 'react';
import { AmbienceType } from '@/types/binaural';

type EnsureAudioContext = () => AudioContext;

type GetDestination = () => AudioNode;

// Reliable public-domain / CORS-enabled audio URLs (freesound.org CDN)
const AMBIENCE_URLS: Record<AmbienceType, string | null> = {
  none: null,
  rain: 'https://cdn.freesound.org/previews/531/531947_6265505-lq.mp3',
  forest: 'https://cdn.freesound.org/previews/462/462087_5121236-lq.mp3',
  drone: 'https://cdn.freesound.org/previews/186/186942_2594536-lq.mp3',
};

export function useAmbiencePlayer(
  ensureAudioContext: EnsureAudioContext,
  getDestination: GetDestination,
  enabled: boolean,
  ambienceType: AmbienceType
) {
  // Separate refs for main playback vs preview
  const mainAudioRef = useRef<HTMLAudioElement | null>(null);
  const mainSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const mainConnectedRef = useRef(false);
  const mainTypeRef = useRef<AmbienceType>('none');

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const previewConnectedRef = useRef(false);
  const previewTypeRef = useRef<AmbienceType>('none');

  const isPreviewingRef = useRef(false);

  // Play main (tied to track playback)
  const startMain = useCallback(
    (type: AmbienceType) => {
      if (type === 'none') return;
      const url = AMBIENCE_URLS[type];
      if (!url) return;

      const ctx = ensureAudioContext();
      const dest = getDestination();

      if (!mainAudioRef.current || mainTypeRef.current !== type) {
        if (mainAudioRef.current) {
          mainAudioRef.current.pause();
          mainAudioRef.current.src = '';
        }
        if (mainSourceRef.current) {
          try { mainSourceRef.current.disconnect(); } catch {}
          mainSourceRef.current = null;
          mainConnectedRef.current = false;
        }

        const el = new Audio();
        el.crossOrigin = 'anonymous';
        el.loop = true;
        el.preload = 'auto';
        el.src = url;
        mainAudioRef.current = el;
        mainTypeRef.current = type;
      }

      if (!mainConnectedRef.current && mainAudioRef.current) {
        try {
          mainSourceRef.current = ctx.createMediaElementSource(mainAudioRef.current);
          mainSourceRef.current.connect(dest);
          mainConnectedRef.current = true;
        } catch {
          mainConnectedRef.current = true;
        }
      }

      mainAudioRef.current?.play().catch((e) => console.log('Ambience autoplay blocked:', e));
    },
    [ensureAudioContext, getDestination]
  );

  const stopMain = useCallback(() => {
    if (mainAudioRef.current) {
      mainAudioRef.current.pause();
      mainAudioRef.current.currentTime = 0;
    }
  }, []);

  // Preview (independent from track playback)
  const stopPreview = useCallback(() => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
    }
    isPreviewingRef.current = false;
  }, []);

  const startPreview = useCallback(
    (type?: AmbienceType) => {
      const typeToPlay = type ?? ambienceType;
      if (typeToPlay === 'none') return;

      const url = AMBIENCE_URLS[typeToPlay];
      if (!url) return;

      const ctx = ensureAudioContext();
      const dest = getDestination();

      if (!previewAudioRef.current || previewTypeRef.current !== typeToPlay) {
        if (previewAudioRef.current) {
          previewAudioRef.current.pause();
          previewAudioRef.current.src = '';
        }
        if (previewSourceRef.current) {
          try { previewSourceRef.current.disconnect(); } catch {}
          previewSourceRef.current = null;
          previewConnectedRef.current = false;
        }

        const el = new Audio();
        el.crossOrigin = 'anonymous';
        el.loop = true;
        el.preload = 'auto';
        el.src = url;
        previewAudioRef.current = el;
        previewTypeRef.current = typeToPlay;
      }

      if (!previewConnectedRef.current && previewAudioRef.current) {
        try {
          previewSourceRef.current = ctx.createMediaElementSource(previewAudioRef.current);
          previewSourceRef.current.connect(dest);
          previewConnectedRef.current = true;
        } catch {
          previewConnectedRef.current = true;
        }
      }

      previewAudioRef.current?.play().catch((e) => console.log('Ambience preview blocked:', e));
      isPreviewingRef.current = true;
    },
    [ambienceType, ensureAudioContext, getDestination]
  );

  // Main playback tied to enabled prop
  useEffect(() => {
    if (enabled && ambienceType !== 'none') {
      startMain(ambienceType);
    } else {
      stopMain();
    }
  }, [ambienceType, enabled, startMain, stopMain]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMain();
      stopPreview();
      if (mainAudioRef.current) {
        mainAudioRef.current.pause();
        mainAudioRef.current.src = '';
      }
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current.src = '';
      }
      try { mainSourceRef.current?.disconnect(); } catch {}
      try { previewSourceRef.current?.disconnect(); } catch {}
    };
  }, [stopMain, stopPreview]);

  return { startPreview, stopPreview };
}
