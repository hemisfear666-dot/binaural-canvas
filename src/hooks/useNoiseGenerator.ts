import { useRef, useCallback, useEffect } from 'react';
import { NoiseType } from '@/types/binaural';

export function useNoiseGenerator(enabled: boolean, noiseType: NoiseType, volume: number) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const noiseNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const isPlayingRef = useRef(false);

  const createNoiseBuffer = useCallback((ctx: AudioContext, type: NoiseType): AudioBuffer => {
    const bufferSize = ctx.sampleRate * 2; // 2 seconds of noise
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);

    if (type === 'white') {
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
    } else if (type === 'pink') {
      // Pink noise using Paul Kellet's algorithm
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    } else if (type === 'brown') {
      // Brown (Brownian) noise
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5; // Boost amplitude
      }
    }

    return buffer;
  }, []);

  const setupAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtxRef.current;
  }, []);

  const startPreview = useCallback((type?: NoiseType) => {
    const typeToPlay = type ?? noiseType;
    
    // Stop any existing playback first
    if (noiseNodeRef.current) {
      try {
        noiseNodeRef.current.stop();
        noiseNodeRef.current.disconnect();
      } catch (e) {}
      noiseNodeRef.current = null;
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
    }

    const ctx = setupAudio();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const buffer = createNoiseBuffer(ctx, typeToPlay);
    const noiseNode = ctx.createBufferSource();
    noiseNode.buffer = buffer;
    noiseNode.loop = true;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);

    noiseNode.connect(gainNode);
    gainNode.connect(ctx.destination);
    noiseNode.start();

    noiseNodeRef.current = noiseNode;
    gainNodeRef.current = gainNode;
    isPlayingRef.current = true;
  }, [noiseType, volume, createNoiseBuffer, setupAudio]);

  const stopPreview = useCallback(() => {
    if (noiseNodeRef.current) {
      try {
        noiseNodeRef.current.stop();
        noiseNodeRef.current.disconnect();
      } catch (e) {
        // Already stopped
      }
      noiseNodeRef.current = null;
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
    }
    isPlayingRef.current = false;
  }, []);

  // Update volume
  useEffect(() => {
    if (gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current.gain.setValueAtTime(volume, audioCtxRef.current.currentTime);
    }
  }, [volume]);

  // Handle enabled state and noise type changes
  useEffect(() => {
    if (enabled) {
      stopPreview();
      startPreview();
    } else {
      stopPreview();
    }
  }, [enabled, noiseType, startPreview, stopPreview]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPreview();
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, [stopPreview]);

  return { startPreview, stopPreview };
}
