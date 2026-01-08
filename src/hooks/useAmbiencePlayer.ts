import { useRef, useCallback, useEffect } from 'react';
import { AmbienceType } from '@/types/binaural';

type EnsureAudioContext = () => AudioContext;

type GetDestination = () => AudioNode;

type RunningAmbience = {
  type: AmbienceType;
  // nodes we may want to stop/disconnect
  sources: (AudioScheduledSourceNode | OscillatorNode)[];
  nodes: AudioNode[];
  stop: () => void;
};

function createNoiseBuffer(ctx: AudioContext, seconds: number) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function createAmbience(ctx: AudioContext, type: AmbienceType, destination: AudioNode): RunningAmbience | null {
  if (type === 'none') return null;

  const sources: (AudioScheduledSourceNode | OscillatorNode)[] = [];
  const nodes: AudioNode[] = [];
  const out = ctx.createGain();
  out.gain.value = 1;
  nodes.push(out);

  const now = ctx.currentTime;

  if (type === 'rain') {
    // Wideband noise + bandpass = "rain" texture
    const src = ctx.createBufferSource();
    src.buffer = createNoiseBuffer(ctx, 2.5);
    src.loop = true;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 350;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    bp.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.value = 0.22;

    src.connect(hp);
    hp.connect(bp);
    bp.connect(gain);
    gain.connect(out);

    sources.push(src);
    nodes.push(hp, bp, gain);
    src.start(now);
  }

  if (type === 'forest') {
    // Pink-ish noise (lowpass) + subtle slow tremolo
    const src = ctx.createBufferSource();
    src.buffer = createNoiseBuffer(ctx, 3.0);
    src.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.Q.value = 0.3;

    const gain = ctx.createGain();
    gain.gain.value = 0.18;

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.08;

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.06;

    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    src.connect(lp);
    lp.connect(gain);
    gain.connect(out);

    sources.push(src, lfo);
    nodes.push(lp, gain, lfoGain);

    src.start(now);
    lfo.start(now);
  }

  if (type === 'drone') {
    // Simple warm drone (two detuned sines) + subtle movement
    const gain = ctx.createGain();
    gain.gain.value = 0.22;

    const oscA = ctx.createOscillator();
    oscA.type = 'sine';
    oscA.frequency.value = 74;

    const oscB = ctx.createOscillator();
    oscB.type = 'sine';
    oscB.frequency.value = 74.6;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 800;
    lp.Q.value = 0.5;

    const drift = ctx.createOscillator();
    drift.type = 'sine';
    drift.frequency.value = 0.05;

    const driftGain = ctx.createGain();
    driftGain.gain.value = 6; // cents-ish effect via Hz offset at this range

    drift.connect(driftGain);
    driftGain.connect(oscB.frequency);

    oscA.connect(lp);
    oscB.connect(lp);
    lp.connect(gain);
    gain.connect(out);

    sources.push(oscA, oscB, drift);
    nodes.push(gain, lp, driftGain);

    oscA.start(now);
    oscB.start(now);
    drift.start(now);
  }

  out.connect(destination);

  const stop = () => {
    for (const s of sources) {
      try {
        s.stop();
      } catch {
        // ignore
      }
    }
    for (const n of nodes) {
      try {
        n.disconnect();
      } catch {
        // ignore
      }
    }
    try {
      out.disconnect();
    } catch {
      // ignore
    }
  };

  return { type, sources, nodes, stop };
}

export function useAmbiencePlayer(
  ensureAudioContext: EnsureAudioContext,
  getDestination: GetDestination,
  enabled: boolean,
  ambienceType: AmbienceType
) {
  const mainRef = useRef<RunningAmbience | null>(null);
  const previewRef = useRef<RunningAmbience | null>(null);

  const stopMain = useCallback(() => {
    if (mainRef.current) {
      mainRef.current.stop();
      mainRef.current = null;
    }
  }, []);

  const stopPreview = useCallback(() => {
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
      mainRef.current = createAmbience(ctx, type, dest);
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
      previewRef.current = createAmbience(ctx, typeToPlay, dest);
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

