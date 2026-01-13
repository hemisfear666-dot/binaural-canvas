import { useCallback, useRef, useEffect } from 'react';
import { AmbientMusicType } from '@/types/binaural';
import { resumeAudioContext } from '@/lib/audio/resumeAudioContext';

interface RunningAmbientMusic {
  type: AmbientMusicType;
  sources: (OscillatorNode | AudioScheduledSourceNode)[];
  nodes: AudioNode[];
  stop: () => void;
}

function createSoothingAmbient(ctx: AudioContext, destination: AudioNode): RunningAmbientMusic {
  const sources: OscillatorNode[] = [];
  const nodes: AudioNode[] = [];

  const out = ctx.createGain();
  out.gain.value = 1;
  nodes.push(out);

  // Warm pad with slow evolving chords
  const padFreqs = [220, 277.18, 329.63, 440]; // A3, C#4, E4, A4 (A major)
  
  padFreqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    
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
  lp.frequency.value = 800;
  lp.Q.value = 0.5;
  
  // Filter LFO
  const filterLfo = ctx.createOscillator();
  filterLfo.type = 'sine';
  filterLfo.frequency.value = 0.03;
  
  const filterLfoGain = ctx.createGain();
  filterLfoGain.gain.value = 200;
  
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

  return { type: 'soothing', sources, nodes, stop };
}

function createFocusAmbient(ctx: AudioContext, destination: AudioNode): RunningAmbientMusic {
  const sources: OscillatorNode[] = [];
  const nodes: AudioNode[] = [];

  const out = ctx.createGain();
  out.gain.value = 1;
  nodes.push(out);

  // Minimal, steady tones for concentration
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

  // Very slow drift
  const driftLfo = ctx.createOscillator();
  driftLfo.type = 'sine';
  driftLfo.frequency.value = 0.02;
  
  const driftGain = ctx.createGain();
  driftGain.gain.value = 2;
  
  driftLfo.connect(driftGain);
  driftGain.connect(osc1.frequency);
  driftGain.connect(osc2.frequency);

  osc1.connect(g1);
  osc2.connect(g2);
  osc3.connect(g3);
  g1.connect(out);
  g2.connect(out);
  g3.connect(out);

  sources.push(osc1, osc2, osc3, driftLfo);
  nodes.push(g1, g2, g3, driftGain);

  osc1.start();
  osc2.start();
  osc3.start();
  driftLfo.start();

  // Soft filtering
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 600;
  lp.Q.value = 0.3;

  out.connect(lp);
  lp.connect(destination);
  nodes.push(lp);

  const stop = () => {
    for (const s of sources) {
      try { s.stop(); } catch { /* ignore */ }
    }
    for (const n of nodes) {
      try { n.disconnect(); } catch { /* ignore */ }
    }
    try { out.disconnect(); lp.disconnect(); } catch { /* ignore */ }
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
