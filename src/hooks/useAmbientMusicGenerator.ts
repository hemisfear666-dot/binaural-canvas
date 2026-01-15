import { useCallback, useRef, useEffect } from 'react';
import { AmbientMusicType } from '@/types/binaural';
import { resumeAudioContext } from '@/lib/audio/resumeAudioContext';

interface RunningAmbientMusic {
  type: AmbientMusicType;
  sources: (OscillatorNode | AudioScheduledSourceNode)[];
  nodes: AudioNode[];
  stop: () => void;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function centsToRatio(cents: number) {
  return Math.pow(2, cents / 1200);
}

function attachRandomPitchWander(
  ctx: AudioContext,
  param: AudioParam,
  baseHz: number,
  opts: {
    maxCents: number;
    stepCents: number;
    intervalMinSec: number;
    intervalMaxSec: number;
    smoothingSec: number;
    startDelaySec?: number;
  }
) {
  let cancelled = false;
  let currentCents = 0;
  let timeoutId: number | null = null;

  const tick = () => {
    if (cancelled) return;

    const step = (Math.random() * 2 - 1) * opts.stepCents;
    currentCents = clamp(currentCents + step, -opts.maxCents, opts.maxCents);

    const targetHz = baseHz * centsToRatio(currentCents);
    // Smoothly move toward the next pitch so it feels like "drift" rather than a jump
    param.setTargetAtTime(targetHz, ctx.currentTime, Math.max(0.001, opts.smoothingSec));

    const nextSec =
      opts.intervalMinSec + Math.random() * Math.max(0, opts.intervalMaxSec - opts.intervalMinSec);

    timeoutId = window.setTimeout(tick, Math.max(150, nextSec * 1000));
  };

  timeoutId = window.setTimeout(tick, Math.max(0, (opts.startDelaySec ?? opts.intervalMinSec) * 1000));

  return () => {
    cancelled = true;
    if (timeoutId !== null) window.clearTimeout(timeoutId);
  };
}

function createSoothingAmbient(ctx: AudioContext, destination: AudioNode): RunningAmbientMusic {
  const sources: OscillatorNode[] = [];
  const nodes: AudioNode[] = [];
  const cancels: Array<() => void> = [];

  const out = ctx.createGain();
  out.gain.value = 1;
  nodes.push(out);

  // Warm pad with slow evolving chords
  const padFreqs = [220, 277.18, 329.63, 440]; // A3, C#4, E4, A4 (A major)

  padFreqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    // Random-walk pitch drift (kept subtle so it doesn't feel "out of tune")
    cancels.push(
      attachRandomPitchWander(ctx, osc.frequency, freq, {
        maxCents: 24,
        stepCents: 10,
        intervalMinSec: 2.5,
        intervalMaxSec: 7,
        smoothingSec: 2.2,
        startDelaySec: 0.8 + i * 0.6,
      })
    );

    const gain = ctx.createGain();
    gain.gain.value = 0.08;

    // Slow tremolo for movement
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.1 + i * 0.02;

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;

    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    osc.connect(gain);
    gain.connect(out);

    sources.push(osc, lfo);
    nodes.push(gain, lfoGain);

    osc.start();
    lfo.start();
  });

  // Soft lowpass filter
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  lp.Q.value = 0.5;

  // Filter LFO
  const filterLfo = ctx.createOscillator();
  filterLfo.type = 'sine';
  filterLfo.frequency.value = 0.03;

  const filterLfoGain = ctx.createGain();
  filterLfoGain.gain.value = 220;

  filterLfo.connect(filterLfoGain);
  filterLfoGain.connect(lp.frequency);

  sources.push(filterLfo);
  nodes.push(lp, filterLfoGain);
  filterLfo.start();

  out.connect(lp);
  lp.connect(destination);

  const stop = () => {
    for (const cancel of cancels) {
      try {
        cancel();
      } catch {
        // ignore
      }
    }
    for (const s of sources) {
      try {
        s.stop();
      } catch {
        /* ignore */
      }
    }
    for (const n of nodes) {
      try {
        n.disconnect();
      } catch {
        /* ignore */
      }
    }
    try {
      out.disconnect();
      lp.disconnect();
    } catch {
      /* ignore */
    }
  };

  return { type: 'soothing', sources, nodes, stop };
}

function createFocusAmbient(ctx: AudioContext, destination: AudioNode): RunningAmbientMusic {
  const sources: OscillatorNode[] = [];
  const nodes: AudioNode[] = [];
  const cancels: Array<() => void> = [];

  const out = ctx.createGain();
  out.gain.value = 1;
  nodes.push(out);

  // Minimal tones for concentration — but with gentle random drift so it's not a static "single tone"
  const baseFreq = 110; // A2

  // Fundamental
  const osc1 = ctx.createOscillator();
  osc1.type = 'triangle';
  osc1.frequency.value = baseFreq;

  const g1 = ctx.createGain();
  g1.gain.value = 0.1;

  // Fifth
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = baseFreq * 1.5;

  const g2 = ctx.createGain();
  g2.gain.value = 0.06;

  // Octave
  const osc3 = ctx.createOscillator();
  osc3.type = 'sine';
  osc3.frequency.value = baseFreq * 2;

  const g3 = ctx.createGain();
  g3.gain.value = 0.04;

  // Random-walk drift (kept subtle)
  cancels.push(
    attachRandomPitchWander(ctx, osc1.frequency, baseFreq, {
      maxCents: 28,
      stepCents: 9,
      intervalMinSec: 1.8,
      intervalMaxSec: 5.5,
      smoothingSec: 1.6,
      startDelaySec: 0.8,
    })
  );
  cancels.push(
    attachRandomPitchWander(ctx, osc2.frequency, baseFreq * 1.5, {
      maxCents: 22,
      stepCents: 8,
      intervalMinSec: 2.2,
      intervalMaxSec: 6.5,
      smoothingSec: 1.8,
      startDelaySec: 1.1,
    })
  );
  cancels.push(
    attachRandomPitchWander(ctx, osc3.frequency, baseFreq * 2, {
      maxCents: 18,
      stepCents: 6,
      intervalMinSec: 2.8,
      intervalMaxSec: 8,
      smoothingSec: 2.2,
      startDelaySec: 1.4,
    })
  );

  // Very slow amplitude breathing
  const ampLfo = ctx.createOscillator();
  ampLfo.type = 'sine';
  ampLfo.frequency.value = 0.06;
  const ampGain = ctx.createGain();
  ampGain.gain.value = 0.03;
  ampLfo.connect(ampGain);
  ampGain.connect(out.gain);

  osc1.connect(g1);
  osc2.connect(g2);
  osc3.connect(g3);
  g1.connect(out);
  g2.connect(out);
  g3.connect(out);

  sources.push(osc1, osc2, osc3, ampLfo);
  nodes.push(g1, g2, g3, ampGain);

  osc1.start();
  osc2.start();
  osc3.start();
  ampLfo.start();

  // Soft filtering
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 650;
  lp.Q.value = 0.3;

  out.connect(lp);
  lp.connect(destination);
  nodes.push(lp);

  const stop = () => {
    for (const cancel of cancels) {
      try {
        cancel();
      } catch {
        // ignore
      }
    }
    for (const s of sources) {
      try {
        s.stop();
      } catch {
        /* ignore */
      }
    }
    for (const n of nodes) {
      try {
        n.disconnect();
      } catch {
        /* ignore */
      }
    }
    try {
      out.disconnect();
      lp.disconnect();
    } catch {
      /* ignore */
    }
  };

  return { type: 'focus', sources, nodes, stop };
}

function createSleepAmbient(ctx: AudioContext, destination: AudioNode): RunningAmbientMusic {
  const sources: OscillatorNode[] = [];
  const nodes: AudioNode[] = [];

  const out = ctx.createGain();
  out.gain.value = 1;
  nodes.push(out);

  // Very deep, slow, minimal tones
  const freqs = [55, 82.41, 110]; // A1, E2, A2
  
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    
    const gain = ctx.createGain();
    gain.gain.value = 0.07 - i * 0.015;
    
    // Very slow breathing-like modulation
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.05 + i * 0.01;
    
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.015;
    
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    
    osc.connect(gain);
    gain.connect(out);
    
    sources.push(osc, lfo);
    nodes.push(gain, lfoGain);
    
    osc.start();
    lfo.start();
  });

  // Very dark lowpass
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 300;
  lp.Q.value = 0.2;
  
  // Ultra-slow filter movement
  const filterLfo = ctx.createOscillator();
  filterLfo.type = 'sine';
  filterLfo.frequency.value = 0.015;
  
  const filterLfoGain = ctx.createGain();
  filterLfoGain.gain.value = 80;
  
  filterLfo.connect(filterLfoGain);
  filterLfoGain.connect(lp.frequency);
  
  sources.push(filterLfo);
  nodes.push(lp, filterLfoGain);
  filterLfo.start();

  out.connect(lp);
  lp.connect(destination);

  const stop = () => {
    for (const s of sources) {
      try { s.stop(); } catch { /* ignore */ }
    }
    for (const n of nodes) {
      try { n.disconnect(); } catch { /* ignore */ }
    }
    try { out.disconnect(); lp.disconnect(); } catch { /* ignore */ }
  };

  return { type: 'sleep', sources, nodes, stop };
}

function createAmbientMusic(ctx: AudioContext, type: AmbientMusicType, destination: AudioNode): RunningAmbientMusic {
  switch (type) {
    case 'soothing':
      return createSoothingAmbient(ctx, destination);
    case 'focus':
      return createFocusAmbient(ctx, destination);
    case 'sleep':
      return createSleepAmbient(ctx, destination);
    default:
      return createSoothingAmbient(ctx, destination);
  }
}

export function useAmbientMusicGenerator(
  ensureCtx: () => AudioContext,
  getDestination: () => GainNode,
  enabled: boolean,
  type: AmbientMusicType
) {
  const runningRef = useRef<RunningAmbientMusic | null>(null);
  const previewRef = useRef<RunningAmbientMusic | null>(null);

  // Main playback (when enabled and playing)
  useEffect(() => {
    if (!enabled) {
      if (runningRef.current) {
        runningRef.current.stop();
        runningRef.current = null;
      }
      return;
    }

    const ctx = ensureCtx();
    const dest = getDestination();

    // Stop previous if type changed
    if (runningRef.current && runningRef.current.type !== type) {
      runningRef.current.stop();
      runningRef.current = null;
    }

    if (!runningRef.current) {
      runningRef.current = createAmbientMusic(ctx, type, dest);
    }

    return () => {
      if (runningRef.current) {
        runningRef.current.stop();
        runningRef.current = null;
      }
    };
  }, [enabled, type, ensureCtx, getDestination]);

  const startPreview = useCallback(async (previewType: AmbientMusicType) => {
    // Stop any existing preview
    if (previewRef.current) {
      previewRef.current.stop();
      previewRef.current = null;
    }

    const ctx = ensureCtx();
    await resumeAudioContext(ctx, 'ambient-music-preview');
    const dest = getDestination();
    previewRef.current = createAmbientMusic(ctx, previewType, dest);
  }, [ensureCtx, getDestination]);

  const stopPreview = useCallback(() => {
    if (previewRef.current) {
      previewRef.current.stop();
      previewRef.current = null;
    }
  }, []);

  return { startPreview, stopPreview };
}
