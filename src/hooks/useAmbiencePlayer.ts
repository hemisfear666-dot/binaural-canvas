import { useRef, useCallback, useEffect } from 'react';
import { AmbienceType } from '@/types/binaural';
import { resumeAudioContext } from '@/lib/audio/resumeAudioContext';
import { createAmbience, type RunningAmbience } from '@/lib/audio/ambience/createAmbience';

type EnsureAudioContext = () => AudioContext;

type GetDestination = () => AudioNode;

export function useAmbiencePlayer(
  ensureAudioContext: EnsureAudioContext,
  getDestination: GetDestination,
  enabled: boolean,
  ambienceType: AmbienceType
) {
  const mainRef = useRef<RunningAmbience | null>(null);
  const previewRef = useRef<RunningAmbience | null>(null);

  const mainTokenRef = useRef(0);
  const previewTokenRef = useRef(0);

  const stopMain = useCallback(() => {
    // cancel any pending async starts
    mainTokenRef.current++;

    if (mainRef.current) {
      mainRef.current.stop();
      mainRef.current = null;
    }
  }, []);

  const stopPreview = useCallback(() => {
    // cancel any pending async starts
    previewTokenRef.current++;

    if (previewRef.current) {
      previewRef.current.stop();
      previewRef.current = null;
    }
  }, []);

  const startMain = useCallback(
    (type: AmbienceType) => {
      if (type === 'none') return;
      const ctx = ensureAudioContext();
      const dest = getDestination();

      if (mainRef.current?.type === type) return;
      stopMain();

      const token = ++mainTokenRef.current;
      void (async () => {
        const ok = await resumeAudioContext(ctx, 'ambience');
        if (!ok || mainTokenRef.current !== token) return;
        mainRef.current = createAmbience(ctx, type, dest);
      })();
    },
    [ensureAudioContext, getDestination, stopMain]
  );

  const startPreview = useCallback(
    (type?: AmbienceType) => {
      const typeToPlay = type ?? ambienceType;
      if (typeToPlay === 'none') return;
      const ctx = ensureAudioContext();
      const dest = getDestination();

      if (previewRef.current?.type === typeToPlay) return;
      stopPreview();

      const token = ++previewTokenRef.current;
      void (async () => {
        const ok = await resumeAudioContext(ctx, 'ambience');
        if (!ok || previewTokenRef.current !== token) return;
        previewRef.current = createAmbience(ctx, typeToPlay, dest);
      })();
    },
    [ambienceType, ensureAudioContext, getDestination, stopPreview]
  );

  // Main playback tied to enabled prop
  useEffect(() => {
    if (enabled && ambienceType !== 'none') {
      startMain(ambienceType);
    } else {
      stopMain();
    }
  }, [ambienceType, enabled, startMain, stopMain]);

  // Cleanup
  useEffect(() => {
    return () => {
      stopMain();
      stopPreview();
    };
  }, [stopMain, stopPreview]);

  return { startPreview, stopPreview };
}

