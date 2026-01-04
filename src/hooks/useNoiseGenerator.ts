import { useRef, useCallback, useEffect } from 'react';
import { NoiseType } from '@/types/binaural';

type EnsureAudioContext = () => AudioContext;

type GetDestination = () => AudioNode;

export function useNoiseGenerator(
  ensureAudioContext: EnsureAudioContext,
  getDestination: GetDestination,
  enabled: boolean,
  noiseType: NoiseType
) {
  const noiseNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const isPlayingRef = useRef(false);

  const createNoiseBuffer = useCallback((ctx: AudioContext, type: NoiseType): AudioBuffer => {
    const bufferSize = ctx.sampleRate * 2; // 2 seconds
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);

    if (type === 'white') {
      for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
    } else if (type === 'pink') {
      // Pink noise (Paul Kellet)
      let b0 = 0,
        b1 = 0,
        b2 = 0,
        b3 = 0,
        b4 = 0,
        b5 = 0,
        b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    } else {
      // Brown noise
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5;
      }
    }

    return buffer;
  }, []);

  const stopPreview = useCallback(() => {
    if (noiseNodeRef.current) {
      try {
        noiseNodeRef.current.stop();
        noiseNodeRef.current.disconnect();
      } catch {
        // ignore
      }
      noiseNodeRef.current = null;
    }
    isPlayingRef.current = false;
  }, []);

  const startPreview = useCallback(
    (type?: NoiseType) => {
      const ctx = ensureAudioContext();
      const dest = getDestination();

      const typeToPlay = type ?? noiseType;

      stopPreview();

      const buffer = createNoiseBuffer(ctx, typeToPlay);
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      noise.connect(dest);
      noise.start();

      noiseNodeRef.current = noise;
      isPlayingRef.current = true;
    },
    [createNoiseBuffer, ensureAudioContext, getDestination, noiseType, stopPreview]
  );

  // Only react to enable/type (NOT volume)
  useEffect(() => {
    if (enabled) startPreview(noiseType);
    else stopPreview();
  }, [enabled, noiseType, startPreview, stopPreview]);

  useEffect(() => {
    return () => {
      stopPreview();
    };
  }, [stopPreview]);

  return { startPreview, stopPreview, isPlayingRef };
}
